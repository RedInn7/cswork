import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addDays,
  buildPlan,
  DEFAULT_GOAL,
  isDay,
  loadGoal,
  minutesFor,
  normalizeGoal,
  oaDateInRange,
  planIcs,
  planStorageKey,
  planWeeks,
  suggestStartStop,
  type PlanGoal,
  type PlanProblem,
} from '../lib/study-plan';

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

void test('the last week takes company problems first and holds two mock OAs', () => {
  const plan = buildPlan({
    goal: goal({ oaDate: addDays(today, 37), weeklyHours: 14, company: amazon }),
    today,
    line: line(50),
    company: oa(10),
  });
  // todo 60 over 30 days.
  assert.equal(plan.daily, 2);
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
  // 30 main days × 2 = the whole line (50) and then 10 company problems; the
  // line comes first before the sprint.
  assert.deepEqual(ids(plan.days[0].problems), ['lc-1', 'lc-2']);
  assert.deepEqual(ids(plan.days[25].problems), ['oa-amazon-1', 'oa-amazon-2']);
  assert.ok(sprint.every((day) => !day.problems.length), 'ahead of schedule: nothing left');

  // A tight plan leaves company problems for the sprint, line problems after them.
  const tight = buildPlan({
    goal: goal({ oaDate: addDays(today, 10), weeklyHours: 7, company: amazon }),
    today,
    line: line(100),
    company: oa(3),
  });
  assert.equal(tight.daily, 2, 'budget-bound');
  assert.deepEqual(ids(tight.days[0].problems), ['lc-1', 'lc-2']);
  assert.deepEqual(ids(tight.days[3].problems), ['oa-amazon-1', 'oa-amazon-2']);
  assert.deepEqual(ids(tight.days[4].problems), ['oa-amazon-3', 'lc-7']);
  assert.equal(tight.days[3].sprint, true);
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
    getItem: (key: string) => entries[key] ?? null,
  });
  assert.equal(planStorageKey('u1'), 'cswork:plan:v1:u1');
  assert.equal(planStorageKey(null), 'cswork:plan:v1:guest');
  const migrated = loadGoal(store({ 'cswork:practice:daily-target': '5' }), 'u1');
  assert.equal(migrated.dailyTarget, 5);
  assert.equal(migrated.status, 'new');
  assert.equal(loadGoal(store({ 'cswork:practice:daily-target': '4' })).dailyTarget, 3);
  const saved = JSON.stringify(goal({ oaDate: '2026-11-01', company: amazon }));
  assert.equal(loadGoal(store({ 'cswork:plan:v1:u1': saved }), 'u1').oaDate, '2026-11-01');
  assert.equal(
    loadGoal(store({ 'cswork:plan:v1:guest': saved }), 'u1').company?.slug,
    'amazon',
    'a plan made before signing in carries over',
  );
  assert.equal(loadGoal(store({ 'cswork:plan:v1:u2': saved }), 'u1').status, 'new');
  assert.deepEqual(loadGoal(store({ 'cswork:plan:v1:guest': '{oops' })), DEFAULT_GOAL);
  assert.deepEqual(
    loadGoal({
      getItem() {
        throw new Error('blocked');
      },
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
  assert.equal(rows.filter((row) => row === 'BEGIN:VEVENT').length, 4);
  assert.equal(rows.filter((row) => row === 'END:VEVENT').length, 4);
  assert.deepEqual(
    rows.filter((row) => row.startsWith('UID:')),
    [
      'UID:cswork-plan-practice@cswork.org',
      'UID:cswork-plan-mock-1@cswork.org',
      'UID:cswork-plan-mock-2@cswork.org',
      'UID:cswork-plan-oa@cswork.org',
    ],
  );
  assert.ok(rows.every((row) => !row.startsWith('DTSTAMP:') || row === 'DTSTAMP:20261014T030405Z'));
  // Practice: today 20:00 local, daily until the day before the OA, mock days excluded.
  assert.ok(rows.includes('DTSTART:20261014T200000'));
  assert.ok(rows.includes('RRULE:FREQ=DAILY;COUNT=12'), rows.join('\n'));
  assert.ok(rows.includes('EXDATE:20261021T200000,20261024T200000'));
  assert.ok(rows.includes('SUMMARY:CSWork 今日行程：4 题'));
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
