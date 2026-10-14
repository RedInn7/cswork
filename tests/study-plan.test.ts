import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addDays,
  buildPlan,
  DEFAULT_GOAL,
  fitPlan,
  mixPlan,
  isDay,
  loadGoal,
  minutesFor,
  normalizeGoal,
  oaDateInRange,
  planIcs,
  planStorageKey,
  planWeeks,
  readTodayTarget,
  suggestStartStop,
  type PlanGoal,
  type PlanProblem,
} from '../lib/study-plan';
import { ROUTE_SLUGS, STOP_PREREQS } from '../lib/route-stops';

const today = '2026-10-14'; // A Wednesday.
const amazon = { slug: 'amazon', name: 'Amazon', aliases: ['amazon'], minutes: 90 };
const goal = (patch: Partial<PlanGoal> = {}): PlanGoal => ({
  ...DEFAULT_GOAL,
  status: 'planned',
  ...patch,
});
const line = (n: number, difficulty = '中等', stop = 0): PlanProblem[] =>
  Array.from({ length: n }, (_, i) => ({ id: `lc-${i + 1}`, difficulty, stop }));
const oa = (n: number): PlanProblem[] =>
  Array.from({ length: n }, (_, i) => ({ id: `oa-amazon-${i + 1}`, difficulty: '中等' }));
const ids = (problems: PlanProblem[]) => problems.map((p) => p.id);

void test('minutes per problem follow the difficulty, medium when unknown', () => {
  assert.equal(minutesFor('简单'), 15);
  assert.equal(minutesFor('Easy'), 15);
  assert.equal(minutesFor('中等'), 25);
  assert.equal(minutesFor('困难'), 40);
  assert.equal(minutesFor('hard'), 40);
  assert.equal(minutesFor(null), 25);
  assert.equal(minutesFor('???'), 25);
});

void test('the daily count spreads the todo over D-7 days, within the weekly budget', () => {
  // 60 line + 0 company, D = 37 → ceil(60 / 30) = 2; budget 14h → floor(120 / 25) = 4.
  const plan = buildPlan({
    goal: goal({ oaDate: addDays(today, 37), weeklyHours: 14 }),
    today,
    line: line(60),
  });
  assert.equal(plan.daysLeft, 37);
  assert.equal(plan.todo, 60);
  assert.equal(plan.avgMinutes, 25);
  assert.equal(plan.daily, 2);
  assert.equal(plan.days.length, 38, 'today through the OA day');
  assert.deepEqual(ids(plan.days[0].problems), ['lc-1', 'lc-2']);
  assert.equal(plan.days[0].minutes, 50);
  assert.equal(plan.days.at(-1)!.oa, true);
  assert.equal(plan.days.at(-1)!.date, addDays(today, 37));
  // The budget wins when time is short: 500 todo, 7h a week → floor(60 / 25) = 2.
  assert.equal(
    buildPlan({ goal: goal({ oaDate: addDays(today, 37) }), today, line: line(500) }).daily,
    2,
  );
  // Hard problems take longer, so the same week fits fewer.
  assert.equal(
    buildPlan({ goal: goal({ weeklyHours: 14 }), today, line: line(50, '困难') }).daily,
    3,
  );
  // At least one a day even on a one-hour week.
  assert.equal(buildPlan({ goal: goal({ weeklyHours: 1 }), today, line: line(9) }).daily, 1);
});

void test('the last week saves the company problems for itself and holds two mock OAs', () => {
  const plan = buildPlan({
    goal: goal({ oaDate: addDays(today, 37), weeklyHours: 14, company: amazon }),
    today,
    line: line(50),
    company: oa(10),
  });
  // The line alone over the 30 days before the sprint: ceil(50 / 30) = 2.
  assert.equal(plan.daily, 2);
  assert.equal(plan.todo, 60);
  const sprint = plan.days.filter((day) => day.sprint && !day.oa);
  assert.equal(sprint.length, 7);
  assert.equal(sprint[0].date, addDays(today, 30));
  assert.ok(plan.days.slice(0, 30).every((day) => !day.sprint));
  assert.deepEqual(
    plan.days.flatMap((day, i) => (day.mock ? [[i, day.mock, day.minutes]] : [])),
    [
      [32, 1, 90],
      [35, 2, 90],
    ],
    'mocks at D-5 and D-2',
  );
  assert.ok(plan.days.filter((day) => day.mock).every((day) => !day.problems.length));
  assert.deepEqual(ids(plan.days[0].problems), ['lc-1', 'lc-2']);
  assert.deepEqual(ids(plan.days[24].problems), ['lc-49', 'lc-50']);
  assert.ok(
    plan.days.slice(0, 30).every((day) => day.problems.every((p) => p.id.startsWith('lc-'))),
    'no company problem before the sprint',
  );
  assert.ok(plan.days.slice(25, 30).every((day) => !day.problems.length), 'ahead of the line');
  // 10 company problems over the sprint's 5 practice days: 2 a day, nothing else.
  assert.deepEqual(
    sprint.map((day) => ids(day.problems)),
    [
      ['oa-amazon-1', 'oa-amazon-2'],
      ['oa-amazon-3', 'oa-amazon-4'],
      [],
      ['oa-amazon-5', 'oa-amazon-6'],
      ['oa-amazon-7', 'oa-amazon-8'],
      [],
      ['oa-amazon-9', 'oa-amazon-10'],
    ],
  );

  // OA in 60 days, 20 left on the line, 10 Amazon problems, 10 h a week.
  const roomy = buildPlan({
    goal: goal({ oaDate: addDays(today, 60), weeklyHours: 10, company: amazon }),
    today,
    line: line(20),
    company: oa(10),
  });
  assert.equal(roomy.daily, 1);
  const firstOa = roomy.days.findIndex((day) => day.problems.some((p) => p.id.startsWith('oa-')));
  assert.equal(firstOa, 53, 'the first company problem waits for the sprint');
  assert.equal(
    roomy.days.filter((day) => day.sprint).flatMap((day) => day.problems).length,
    10,
  );

  // A tight plan: the company's pace in the sprint, the line once they run out.
  const tight = buildPlan({
    goal: goal({ oaDate: addDays(today, 10), weeklyHours: 7, company: amazon }),
    today,
    line: line(100),
    company: oa(3),
  });
  assert.equal(tight.daily, 2, 'budget-bound');
  assert.deepEqual(ids(tight.days[0].problems), ['lc-1', 'lc-2']);
  assert.equal(tight.days[3].sprint, true);
  assert.deepEqual(ids(tight.days[3].problems), ['oa-amazon-1']);
  assert.deepEqual(ids(tight.days[4].problems), ['oa-amazon-2']);
  assert.deepEqual(ids(tight.days[6].problems), ['oa-amazon-3']);
  assert.deepEqual(ids(tight.days[7].problems), ['lc-7', 'lc-8']);
});

void test('solving today\'s problems keeps today\'s goal and this week\'s plan', () => {
  // D = 17 (10 days before the sprint), 14 h a week, 21 left: 3 a day.
  const plan = (left: number, solved: number) =>
    buildPlan({
      goal: goal({ oaDate: addDays(today, 17), weeklyHours: 14 }),
      today,
      line: line(21).slice(21 - left),
      done: { line: solved },
    });
  const morning = plan(21, 0);
  assert.equal(morning.daily, 3);
  assert.equal(planWeeks(morning.days)[0].problems, 15, 'Wednesday to Sunday');
  for (const solved of [1, 3, 4]) {
    const later = plan(21 - solved, solved);
    assert.equal(later.daily, 3, `${solved} solved: still 3`);
    assert.equal(later.days[0].done, solved);
    assert.equal(later.days[0].problems.length, Math.max(0, 3 - solved));
    assert.equal(planWeeks(later.days)[0].problems, solved > 3 ? 16 : 15);
  }
  assert.deepEqual(ids(plan(20, 1).days[0].problems), ['lc-2', 'lc-3']);

  // In the sprint, company problems solved today count the same way.
  const sprint = buildPlan({
    goal: goal({ oaDate: addDays(today, 7), weeklyHours: 14, company: amazon }),
    today,
    line: line(5),
    company: oa(8),
    done: { company: 2 },
  });
  assert.equal(sprint.daily, 2, '10 over 5 practice days');
  assert.deepEqual(sprint.days[0].problems, []);
  assert.equal(sprint.days[0].done, 2);
  assert.deepEqual(ids(sprint.days[1].problems), ['oa-amazon-1', 'oa-amazon-2']);
});

void test('OA today, soon, past and too far', () => {
  const todayPlan = buildPlan({ goal: goal({ oaDate: today }), today, line: line(10) });
  assert.equal(todayPlan.daysLeft, 0);
  assert.deepEqual(
    todayPlan.days.map((day) => [day.date, !!day.oa, day.problems.length]),
    [[today, true, 0]],
  );
  const mocks = (d: number) =>
    buildPlan({ goal: goal({ oaDate: addDays(today, d) }), today, line: line(40) })
      .days.flatMap((day, i) => (day.mock ? [i] : []));
  assert.deepEqual(mocks(1), [0], 'one mock when one day is left');
  assert.deepEqual(mocks(2), [0]);
  assert.deepEqual(mocks(3), [0, 1]);
  assert.deepEqual(mocks(7), [2, 5]);
  const soon = buildPlan({ goal: goal({ oaDate: addDays(today, 3) }), today, line: line(40) });
  // D' clamps to 1, so the budget sets the pace; no company: the sprint rides the line.
  assert.equal(soon.daily, 2);
  assert.ok(soon.days.every((day) => day.sprint));
  assert.deepEqual(ids(soon.days[2].problems), ['lc-1', 'lc-2']);

  const past = buildPlan({ goal: goal({ oaDate: addDays(today, -1) }), today, line: line(40) });
  assert.equal(past.daysLeft, null);
  assert.equal(past.expired, true);
  assert.equal(past.days.length, 28, 'open-ended');
  assert.ok(past.days.every((day) => !day.sprint && !day.oa && !day.mock));

  const far = buildPlan({ goal: goal({ oaDate: addDays(today, 366) }), today, line: line(40) });
  assert.equal(far.daysLeft, null);
  assert.equal(far.expired, false);
  const edge = buildPlan({ goal: goal({ oaDate: addDays(today, 365) }), today, line: line(40) });
  assert.equal(edge.daysLeft, 365);
  assert.equal(edge.days.length, 366);

  assert.equal(oaDateInRange(today, today), true);
  assert.equal(oaDateInRange(addDays(today, 365), today), true);
  assert.equal(oaDateInRange(addDays(today, 366), today), false);
  assert.equal(oaDateInRange(addDays(today, -1), today), false);
  assert.equal(oaDateInRange('2026-02-30', today), false);
});

void test('no company, all solved and a later starting stop', () => {
  const none = buildPlan({ goal: goal(), today, line: line(10) });
  assert.equal(none.daysLeft, null);
  assert.equal(none.daily, 2);
  assert.equal(none.days.filter((day) => day.problems.length).length, 5);

  const done = buildPlan({
    goal: goal({ oaDate: addDays(today, 20), company: amazon }),
    today,
    line: [],
    company: [],
  });
  assert.equal(done.todo, 0);
  assert.equal(done.daily, 0);
  assert.ok(done.days.every((day) => !day.problems.length));
  assert.equal(done.days.filter((day) => day.mock).length, 2, 'mocks still run');

  const later = buildPlan({
    goal: goal({ startStop: 1 }),
    today,
    line: [...line(5, '简单', 0), { id: 'lc-99', difficulty: '困难', stop: 1 }],
  });
  assert.equal(later.todo, 1);
  assert.equal(later.avgMinutes, 40);
  assert.deepEqual(ids(later.days[0].problems), ['lc-99']);
});

void test('weeks start on Monday and add up their days', () => {
  const plan = buildPlan({
    goal: goal({ oaDate: addDays(today, 12), company: amazon }),
    today,
    line: [...line(4, '中等', 2), ...line(30, '中等', 3).map((p, i) => ({ ...p, id: `lc-${i + 10}` }))],
    company: oa(2),
  });
  const weeks = planWeeks(plan.days);
  assert.deepEqual(
    weeks.map((w) => [w.start, w.end]),
    [
      ['2026-10-14', '2026-10-18'],
      ['2026-10-19', '2026-10-25'],
      ['2026-10-26', '2026-10-26'],
    ],
  );
  assert.equal(
    weeks.reduce((sum, w) => sum + w.problems, 0),
    plan.days.reduce((sum, d) => sum + d.problems.length, 0),
  );
  assert.deepEqual(weeks[0].stops, [2, 3]);
  assert.equal(weeks[0].sprint, false);
  assert.equal(weeks[1].sprint, true);
  assert.equal(weeks[1].mocks, 2);
  assert.equal(weeks[2].oa, true);
  assert.equal(weeks[2].problems, 0);
});

void test('LeetCode experience suggests a later stop', () => {
  const totals = [14, 15, 14, 16];
  assert.equal(suggestStartStop(totals, 0), 0);
  assert.equal(suggestStartStop(totals, Number.NaN), 0);
  assert.equal(suggestStartStop(totals, 27), 0, 'half of 27 does not cover stop 1');
  assert.equal(suggestStartStop(totals, 30), 1);
  assert.equal(suggestStartStop(totals, 60), 2);
  assert.equal(suggestStartStop(totals, 5000), 3, 'never past the last stop');
  assert.equal(suggestStartStop([], 50), 0);
});

void test('goals load from this account, a guest plan or the old daily target', () => {
  const store = (entries: Record<string, string>) => ({
    entries,
    getItem: (key: string) => entries[key] ?? null,
    setItem: (key: string, value: string) => {
      entries[key] = value;
    },
    removeItem: (key: string) => {
      delete entries[key];
    },
  });
  assert.equal(planStorageKey('u1'), 'cswork:plan:v1:u1');
  assert.equal(planStorageKey(null), 'cswork:plan:v1:guest');
  const migrated = loadGoal(store({ 'cswork:practice:daily-target': '5' }), 'u1');
  assert.equal(migrated.dailyTarget, 5);
  assert.equal(migrated.status, 'new');
  assert.equal(loadGoal(store({ 'cswork:practice:daily-target': '4' })).dailyTarget, 3);
  const saved = JSON.stringify(goal({ oaDate: '2026-11-01', company: amazon }));
  assert.equal(loadGoal(store({ 'cswork:plan:v1:u1': saved }), 'u1').oaDate, '2026-11-01');
  const shared = store({ 'cswork:plan:v1:guest': saved });
  assert.equal(
    loadGoal(shared, 'u1').company?.slug,
    'amazon',
    'a plan made before signing in carries over',
  );
  assert.equal(shared.entries['cswork:plan:v1:u1'], saved);
  assert.equal('cswork:plan:v1:guest' in shared.entries, false, 'once');
  assert.equal(loadGoal(shared, 'u2').status, 'new', 'the next account starts fresh');
  assert.equal(loadGoal(shared, 'u1').company?.slug, 'amazon');
  assert.equal(loadGoal(store({ 'cswork:plan:v1:u2': saved }), 'u1').status, 'new');
  assert.deepEqual(loadGoal(store({ 'cswork:plan:v1:guest': '{oops' })), DEFAULT_GOAL);
  assert.deepEqual(
    loadGoal({
      getItem() {
        throw new Error('blocked');
      },
      setItem() {},
      removeItem() {},
    }),
    DEFAULT_GOAL,
  );
  const cleaned = normalizeGoal({
    status: 'weird',
    oaDate: '2026-02-30',
    weeklyHours: 41,
    solvedBefore: -1,
    startStop: 1.5,
    company: { slug: 'Bad Slug', name: 'x', aliases: [] },
  });
  assert.deepEqual(cleaned, DEFAULT_GOAL);
  assert.equal(isDay('2026-02-28'), true);
  assert.equal(isDay('2026-2-28'), false);
});

void test('today\'s target for the AC dialog: the bank page\'s, else the old "n a day"', () => {
  const read = (entries: Record<string, string>) =>
    readTodayTarget({ getItem: (key) => entries[key] ?? null }, today);
  const set = (date: string, n: unknown) => JSON.stringify({ date, n });
  assert.equal(read({}), 3);
  assert.equal(read({ 'cswork:practice:daily-target': '5' }), 5);
  assert.equal(
    read({ 'cswork:practice:today-target': set(today, 7), 'cswork:practice:daily-target': '5' }),
    7,
  );
  assert.equal(read({ 'cswork:practice:today-target': set(today, 0) }), 0, 'a mock OA day');
  assert.equal(
    read({ 'cswork:practice:today-target': set(addDays(today, -1), 7), 'cswork:practice:daily-target': '2' }),
    2,
    'yesterday\'s target is stale',
  );
  assert.equal(read({ 'cswork:practice:today-target': set(today, 1.5) }), 3);
  assert.equal(read({ 'cswork:practice:today-target': '{oops' }), 3);
  assert.equal(
    readTodayTarget(
      {
        getItem() {
          throw new Error('blocked');
        },
      },
      today,
    ),
    3,
  );
});

const unfold = (ics: string) => ics.replace(/\r\n /g, '');
const octets = (line: string) => Buffer.byteLength(line, 'utf8');

void test('the .ics is RFC 5545: CRLF, folded at 75 octets, escaped, stable UIDs', () => {
  const company = { ...amazon, name: 'Amazon, Inc; 亚马逊 ' + '超长的公司名称'.repeat(6) };
  const g = goal({ oaDate: addDays(today, 12), company, weeklyHours: 14 });
  const plan = buildPlan({ goal: g, today, line: line(40), company: oa(4) });
  const ics = planIcs({
    plan,
    goal: g,
    now: new Date('2026-10-14T03:04:05.678Z'),
    origin: 'https://cswork.test',
  });
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/[^\r]\n/.test(ics), 'every line ends in CRLF');
  for (const row of ics.split('\r\n')) assert.ok(octets(row) <= 75, row);
  const text = unfold(ics);
  const rows = text.split('\r\n');
  assert.equal(rows[0], 'BEGIN:VCALENDAR');
  assert.ok(rows.includes('VERSION:2.0'));
  assert.ok(rows.some((row) => row.startsWith('PRODID:')));
  assert.equal(rows.filter((row) => row === 'BEGIN:VEVENT').length, 5);
  assert.equal(rows.filter((row) => row === 'END:VEVENT').length, 5);
  assert.deepEqual(
    rows.filter((row) => row.startsWith('UID:')),
    [
      'UID:cswork-plan-practice@cswork.org',
      'UID:cswork-plan-sprint@cswork.org',
      'UID:cswork-plan-mock-1@cswork.org',
      'UID:cswork-plan-mock-2@cswork.org',
      'UID:cswork-plan-oa@cswork.org',
    ],
  );
  assert.ok(rows.every((row) => !row.startsWith('DTSTAMP:') || row === 'DTSTAMP:20261014T030405Z'));
  // The line: today 20:00 local through the day before the sprint, 4 a day.
  assert.ok(rows.includes('DTSTART:20261014T200000'));
  assert.ok(rows.includes('RRULE:FREQ=DAILY;COUNT=5'), rows.join('\n'));
  assert.ok(rows.includes('SUMMARY:CSWork 今日行程：4 题'));
  // The sprint: 4 company problems over 5 practice days, mock days excluded.
  assert.ok(rows.includes('DTSTART:20261019T200000'));
  assert.ok(rows.includes('RRULE:FREQ=DAILY;COUNT=7'));
  assert.ok(rows.includes('EXDATE:20261021T200000,20261024T200000'));
  assert.ok(rows.includes(`SUMMARY:CSWork 冲刺：1 题 · Amazon\\, Inc\\; 亚马逊 ${'超长的公司名称'.repeat(6)}`));
  assert.ok(rows.includes('URL:https://cswork.test/?view=problems'));
  assert.ok(rows.includes('URL:https://cswork.test/mock-oa/amazon'));
  assert.ok(rows.includes('DURATION:PT90M'));
  // The OA day: all day, with a reminder the morning before.
  assert.ok(rows.includes('DTSTART;VALUE=DATE:20261026'));
  assert.ok(rows.includes('DTEND;VALUE=DATE:20261027'));
  assert.ok(rows.includes('TRIGGER:-PT15H'));
  assert.ok(
    rows.includes(`SUMMARY:OA 日 · Amazon\\, Inc\\; 亚马逊 ${'超长的公司名称'.repeat(6)}`),
    'escaped and unfolded back to one line',
  );
  // Same plan, later download: only DTSTAMP changes, so a re-import replaces events.
  const again = planIcs({
    plan,
    goal: g,
    now: new Date('2026-10-15T00:00:00Z'),
    origin: 'https://cswork.test',
  });
  const strip = (s: string) => unfold(s).replace(/DTSTAMP:\d{8}T\d{6}Z/g, '');
  assert.equal(strip(again), strip(ics));
});

void test('the .ics without a company, an OA date or anything left', () => {
  const g = goal({ oaDate: addDays(today, 9) });
  const solved = planIcs({
    plan: buildPlan({ goal: g, today, line: [] }),
    goal: g,
    now: new Date('2026-10-14T00:00:00Z'),
    origin: 'https://cswork.test',
    english: true,
  });
  const rows = unfold(solved).split('\r\n');
  assert.ok(!rows.includes('UID:cswork-plan-practice@cswork.org'), 'no practice left');
  assert.ok(rows.includes('URL:https://cswork.test/mock-oa'));
  assert.ok(rows.includes('SUMMARY:CSWork mock OA #1'));
  assert.ok(rows.includes('SUMMARY:OA day'));
  const open = unfold(
    planIcs({
      plan: buildPlan({ goal: goal(), today, line: line(3) }),
      goal: goal(),
      now: new Date('2026-10-14T00:00:00Z'),
      origin: 'https://cswork.test',
      english: true,
    }),
  ).split('\r\n');
  assert.ok(open.includes('RRULE:FREQ=DAILY;COUNT=2'));
  assert.ok(open.includes('SUMMARY:CSWork daily trip: 2 problems'));
  assert.ok(!open.some((row) => row.startsWith('UID:cswork-plan-oa')));
});

// Problems on given stops: `per` each, ids lc-<stop>-<k>.
const stops = (list: number[], per: number, extra: (k: number) => Partial<PlanProblem> = () => ({})) =>
  list.flatMap((stop) =>
    Array.from({ length: per }, (_, k) => ({ id: `lc-${stop}-${k}`, difficulty: '中等', stop, ...extra(k) })),
  );
const firstAt = (problems: PlanProblem[]) => {
  const at = new Map<number, number>();
  problems.forEach((p, i) => {
    if (p.stop !== undefined && !at.has(p.stop)) at.set(p.stop, i);
  });
  return at;
};

void test('a plan too short for the line keeps some of every stop, foundations and easier ratings first', () => {
  // No date, one week at 7 h: 2 a day for 7 days = 14 of 50 problems.
  const line = stops([0, 1, 2, 3, 4], 10, (k) => ({ stage: k < 3 ? 0 : 1, rating: 2000 - k * 100 }));
  const plan = buildPlan({ goal: goal({ weeks: 1 }), today, line });
  const kept = plan.days.flatMap((day) => day.problems);
  assert.equal(plan.days.length, 7);
  assert.equal(kept.length, 14);
  assert.equal(plan.todo, 50);
  assert.equal(plan.cut, 36);
  assert.deepEqual([...new Set(kept.map((p) => p.stop))].sort(), [0, 1, 2, 3, 4], 'every stop');
  // Stop 0 keeps three: its foundation problems (k < 3), not its lower-rated core ones.
  assert.deepEqual(
    kept.filter((p) => p.stop === 0).map((p) => p.id),
    ['lc-0-0', 'lc-0-1', 'lc-0-2'],
  );
  // Within a stage the lower rating wins; shares follow stop size.
  const fit = fitPlan(
    [...stops([5], 4, (k) => ({ stage: 1, rating: 1000 + (3 - k) * 100 })), ...stops([6], 12)],
    8,
  );
  assert.deepEqual(fit.filter((p) => p.stop === 5).map((p) => p.id), ['lc-5-2', 'lc-5-3']);
  assert.equal(fit.filter((p) => p.stop === 6).length, 6);
  assert.deepEqual(fitPlan(line, 0), []);
  assert.equal(fitPlan(line, 99).length, 50);
  // With an OA date the same: 10 days, the line before the sprint and after the mocks.
  const dated = buildPlan({ goal: goal({ oaDate: addDays(today, 10) }), today, line });
  assert.ok(dated.cut > 0);
  assert.equal(new Set(dated.days.flatMap((day) => day.problems.map((p) => p.stop))).size, 5);
  assert.equal(dated.daily, 2, 'the budget still sets the pace');
});

void test('weeks mix stops, and a stop starts only after its prerequisites in the plan', () => {
  // array-foundations (0) comes before hash-counting (1) and string-processing (2).
  const plan = buildPlan({ goal: goal({ weeklyHours: 14 }), today, line: stops([0, 1, 2], 6) });
  const order = plan.days.flatMap((day) => day.problems);
  assert.equal(order[0].stop, 0);
  assert.deepEqual(order.slice(0, 6).map((p) => p.stop), [0, 0, 1, 2, 0, 1]);
  assert.ok(planWeeks(plan.days)[0].stops.length >= 2, 'several topics in the first week');
  assert.deepEqual(planWeeks(plan.days)[0].stops, [0, 1, 2]);

  // The whole line, shuffled any way: every prerequisite in the plan shows up first.
  const all = stops(ROUTE_SLUGS.map((_, i) => i), 2);
  const orders = [0, 1, 2, 7, 42].map((shuffle) => mixPlan(all, shuffle));
  for (const mixed of orders) {
    assert.deepEqual(mixed.map((p) => p.id).toSorted(), all.map((p) => p.id).toSorted());
    const at = firstAt(mixed);
    ROUTE_SLUGS.forEach((slug, stop) => {
      for (const p of STOP_PREREQS[slug])
        assert.ok(at.get(ROUTE_SLUGS.indexOf(p))! < at.get(stop)!, `${p} before ${slug}`);
    });
  }
  assert.notDeepEqual(orders[0].map((p) => p.id), orders[1].map((p) => p.id), 'regenerate reshuffles');
  // A prerequisite outside the plan does not hold a stop back.
  assert.deepEqual(
    mixPlan(stops([8, 13], 2)).map((p) => p.stop),
    [8, 13, 8, 13],
    'grid search rides from the start when binary trees are not in the plan',
  );
});

void test('difficulty and topic filters, an empty result, the pool and the plan length', () => {
  const line = [
    { id: 'lc-1', difficulty: '简单', stop: 0 },
    { id: 'lc-2', difficulty: '困难', stop: 5 },
    { id: 'lc-3', difficulty: '中等', stop: 5 },
  ];
  const hard = buildPlan({ goal: goal({ difficulties: ['hard'] }), today, line });
  assert.deepEqual(hard.days.flatMap((day) => ids(day.problems)), ['lc-2']);
  assert.equal(hard.filtered, 2);
  const search = buildPlan({ goal: goal({ topics: ['binary-search'] }), today, line });
  assert.deepEqual(search.days.flatMap((day) => ids(day.problems)), ['lc-2', 'lc-3']);
  // Nothing left under the filters: an empty plan that says why.
  const none = buildPlan({ goal: goal({ difficulties: ['easy'], topics: ['binary-search'] }), today, line });
  assert.equal(none.todo, 0);
  assert.equal(none.filtered, 3);
  assert.equal(none.daily, 0);
  assert.ok(none.days.every((day) => !day.problems.length));
  // A classic list ignores the start stop; its problems off the line drop out of a topic filter.
  const listed = [{ id: 'lc-9', difficulty: 'Easy' }, ...line];
  assert.equal(buildPlan({ goal: goal({ pool: 'blind-75', startStop: 3 }), today, line: listed }).todo, 4);
  assert.equal(buildPlan({ goal: goal({ startStop: 3 }), today, line }).todo, 2);
  assert.equal(buildPlan({ goal: goal({ pool: 'blind-75', topics: ['array-foundations'] }), today, line: listed }).todo, 1);
  // Without a date, the weeks set the length.
  assert.equal(buildPlan({ goal: goal({ weeks: 2 }), today, line }).days.length, 14);
  assert.equal(buildPlan({ goal: goal({ weeks: 26, oaDate: addDays(today, 3) }), today, line }).days.length, 4);

  const normal = normalizeGoal({
    pool: 'leetcode-hot-100',
    weeks: 26,
    difficulties: ['hard', 'bogus', 'easy'],
    topics: ['binary-search', 'nope'],
    shuffle: 3,
  });
  assert.equal(normal.pool, 'leetcode-hot-100');
  assert.equal(normal.weeks, 26);
  assert.deepEqual(normal.difficulties, ['easy', 'hard']);
  assert.deepEqual(normal.topics, ['binary-search']);
  assert.equal(normal.shuffle, 3);
  const odd = normalizeGoal({ pool: 'hot-100', weeks: 27, difficulties: [], topics: [...ROUTE_SLUGS] });
  assert.equal(odd.pool, 'line');
  assert.equal(odd.weeks, 4);
  assert.deepEqual(odd.difficulties, ['easy', 'medium', 'hard'], 'none reads as all');
  assert.deepEqual(odd.topics, [], 'every stop reads as all');
});
