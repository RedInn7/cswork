/**
 * Sprint plan: count back from an OA date to a daily trip on the 500 line.
 * Pure (days are local 'YYYY-MM-DD' strings) and shared by the bank page and its
 * tests. The goal lives in this browser (planStorageKey) and, signed in, in the
 * account's pref:plan note too (mergeGoals).
 */
import { calendar, escapeText, vevent } from './ics';
import { slotOf, SLOTS, type Slot } from './mock-oa';
import { ROUTE_SLUGS, stopPrereqs } from './route-stops';

export type PlanCompany = {
  slug: string;
  name: string;
  /** OA company slugs the mock OA preset draws from. */
  aliases: string[];
  /** Mock OA length, for the calendar. */
  minutes: number;
};
export type PlanGoal = {
  /** 'planned' once the card is saved; 'skipped' hides the card for good. */
  status: 'new' | 'skipped' | 'planned';
  /** Local day of the OA, or '' for none. */
  oaDate: string;
  company: PlanCompany | null;
  weeklyHours: number;
  /** LeetCode problems solved elsewhere; it suggests startStop. */
  solvedBefore: number;
  /** 0-based stop the plan starts at; earlier stops count as covered. */
  startStop: number;
  /** "n a day" whenever no plan applies (was cswork:practice:daily-target). */
  dailyTarget: number;
  /** Where the line's part of the plan comes from: Line 500 or a classic list's slug. */
  pool: PlanPool;
  /** Plan length without a usable OA date. */
  weeks: number;
  /** Difficulties to plan (all by default). */
  difficulties: Slot[];
  /** Stop slugs to plan; empty plans every stop. */
  topics: string[];
  /** "Regenerate" bumps it: other stops ride together, the unsolved problems stay the same. */
  shuffle: number;
  /** Time of the placement quiz result (lib/placement.ts) whose known stops the form last unticked; 0 for none. */
  placementAt: number;
  /** When it was last saved (this device's clock); 0 before v3. */
  updatedAt: number;
  /** Sprint to the OA and interview dates on the application tracker too. */
  tracker: boolean;
};
/**
 * One problem left to do; stop is its 0-based stop on the line (OA problems and list
 * problems off the line have none). stage (0 基础 … 2 进阶) and rating pick what a short
 * plan keeps.
 */
export type PlanProblem = {
  id: string;
  difficulty?: string | null;
  stop?: number;
  stage?: number;
  rating?: number | null;
};
export type PlanDay = {
  date: string;
  problems: PlanProblem[];
  minutes: number;
  /** The last week before the OA: target-company problems first. */
  sprint: boolean;
  /** Today only: problems of the plan already solved today, still part of its goal. */
  done?: number;
  /** 1 or 2 on a mock OA day, which has no other problems. */
  mock?: number;
  oa?: boolean;
  /** A tracker sprint's day (its mock OA too): the company's problems while they last. */
  sprintFor?: PlanSprint;
  /** A tracker OA deadline or interview: no problems. */
  event?: PlanSprint;
};
export type Plan = {
  /** Days until the OA (0 = today), or null without a usable date. */
  daysLeft: number | null;
  /** The saved OA date has passed; the plan runs open-ended until it is changed. */
  expired: boolean;
  /** Problems left under the filters, line and company. */
  todo: number;
  avgMinutes: number;
  /** Today's pace (the line's, or the sprint's in the last week), as of this morning. */
  daily: number;
  /** Today through the OA day, or goal.weeks without a date. */
  days: PlanDay[];
  /** Problems the difficulty and topic filters leave out. */
  filtered: number;
  /** Of todo, the problems left out so the rest fit before the OA (or in goal.weeks). */
  cut: number;
  /** The tracker's sprints, soonest first. */
  sprints: SprintGroup[];
  /** Tracker dates in the OA's last week, which keeps its own sprint. */
  skipped: number;
};
/** An OA deadline or interview on the application tracker (lib/applications.ts agenda). */
export type PlanEvent = {
  /** The card's id. */
  id: string;
  kind: 'oa' | 'interview';
  /** Its local day. */
  date: string;
  company: string;
  /** The company page's slug, or ''. */
  slug: string;
  /** An onsite gets a longer sprint than an OA or a phone screen. */
  onsite: boolean;
  /** The company's mock OA preset, or null. */
  preset: string | null;
  /** That mock OA's length. */
  minutes: number;
};
export type PlanSprint = PlanEvent & { days: string[] };
/** One sprint, or neighbours merged because one got fewer than 2 days. */
export type SprintGroup = { events: PlanSprint[]; days: string[]; tight: boolean };
export type PlanWeek = {
  start: string;
  end: string;
  days: PlanDay[];
  problems: number;
  minutes: number;
  mocks: number;
  sprint: boolean;
  oa: boolean;
  /** The stops of the week's line problems, in plan order. */
  stops: number[];
};

export const MINUTES = { easy: 15, medium: 25, hard: 40 } as const;
export const SPRINT_DAYS = 7;
export const MAX_DAYS = 365;
export const DAILY_TARGETS = [1, 2, 3, 5];
/** Line 500, then the classic lists (lib/classic-lists.ts slugs) a plan can draw from. */
export const PLAN_POOLS = [
  'line',
  'grind-75',
  'blind-75',
  'leetcode-75',
  'leetcode-hot-100',
  'top-interview-150',
] as const;
export type PlanPool = (typeof PLAN_POOLS)[number];
export const MAX_WEEKS = 26;
/** How many stops ride together while the plan mixes them. */
const MIX = 3;
export const LEGACY_TARGET_KEY = 'cswork:practice:daily-target';
/** {date, n}: today's target as the bank page set it, read by the workspace's AC dialog. */
export const TODAY_TARGET_KEY = 'cswork:practice:today-target';
export const planStorageKey = (userId?: string | null) =>
  `cswork:plan:v1:${userId || 'guest'}`;
export const DEFAULT_GOAL: PlanGoal = {
  status: 'new',
  oaDate: '',
  company: null,
  weeklyHours: 7,
  solvedBefore: 0,
  startStop: 0,
  dailyTarget: 3,
  pool: 'line',
  weeks: 4,
  difficulties: [...SLOTS],
  topics: [],
  shuffle: 0,
  placementAt: 0,
  updatedAt: 0,
  tracker: true,
};

const DAY = 86400000;
const pad = (n: number) => String(n).padStart(2, '0');
const dayNumber = (date: string) =>
  Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / DAY;
const fromNumber = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
/** A real calendar day ('2026-02-30' is not). */
export const isDay = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) && fromNumber(dayNumber(date)) === date;
export const localDay = (now = new Date()) =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
export const addDays = (date: string, n: number) => fromNumber(dayNumber(date) + n);
export const daysBetween = (from: string, to: string) =>
  dayNumber(to) - dayNumber(from);
/** Monday = 0, like the practice calendar. */
export const weekday = (date: string) => (new Date(dayNumber(date) * DAY).getUTCDay() + 6) % 7;

export const minutesFor = (difficulty?: string | null) =>
  MINUTES[slotOf(difficulty?.toLowerCase()) ?? 'medium'];

const int = (value: unknown, min: number, max: number, fallback: number) =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max
    ? (value as number)
    : fallback;
/** Whatever storage held, as a valid goal. */
export function normalizeGoal(raw: unknown): PlanGoal {
  const g = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const c = (g.company && typeof g.company === 'object' ? g.company : null) as Record<
    string,
    unknown
  > | null;
  const company =
    c &&
    typeof c.slug === 'string' &&
    /^[a-z0-9-]{1,80}$/.test(c.slug) &&
    typeof c.name === 'string' &&
    Array.isArray(c.aliases) &&
    c.aliases.every((a) => typeof a === 'string' && /^[a-z0-9-]{1,80}$/.test(a))
      ? {
          slug: c.slug,
          name: c.name.slice(0, 80),
          aliases: (c.aliases as string[]).slice(0, 8),
          minutes: int(c.minutes, 15, 300, 90),
        }
      : null;
  return {
    status: g.status === 'planned' || g.status === 'skipped' ? g.status : 'new',
    oaDate: typeof g.oaDate === 'string' && isDay(g.oaDate) ? g.oaDate : '',
    company,
    weeklyHours: int(g.weeklyHours, 1, 40, DEFAULT_GOAL.weeklyHours),
    solvedBefore: int(g.solvedBefore, 0, 5000, 0),
    startStop: int(g.startStop, 0, 99, 0),
    dailyTarget: DAILY_TARGETS.includes(g.dailyTarget as number)
      ? (g.dailyTarget as number)
      : DEFAULT_GOAL.dailyTarget,
    pool: PLAN_POOLS.includes(g.pool as PlanPool) ? (g.pool as PlanPool) : 'line',
    weeks: int(g.weeks, 1, MAX_WEEKS, DEFAULT_GOAL.weeks),
    // None chosen reads as all, like a goal saved before the filters existed.
    difficulties: SLOTS.some((slot) => Array.isArray(g.difficulties) && g.difficulties.includes(slot))
      ? SLOTS.filter((slot) => (g.difficulties as unknown[]).includes(slot))
      : [...SLOTS],
    topics: Array.isArray(g.topics)
      ? ((chosen) => (chosen.length === ROUTE_SLUGS.length ? [] : chosen))(
          ROUTE_SLUGS.filter((slug) => (g.topics as unknown[]).includes(slug)),
        )
      : [],
    shuffle: int(g.shuffle, 0, 1e6, 0),
    placementAt: int(g.placementAt, 0, 8.64e15, 0),
    updatedAt: int(g.updatedAt, 0, 8.64e15, 0),
    tracker: g.tracker !== false,
  };
}

/**
 * This browser's goal against the account's (pref:plan). With none saved there (a first-visit
 * card counts as none) the local one stands, and goes up unless it is a first-visit card too;
 * a first-visit card takes the account's; otherwise the later save wins, and a later local one
 * goes up (a failed PUT catches up on the next visit). First-visit cards never go up, so the
 * "n a day" picker on one device cannot wipe a plan another device has not uploaded yet.
 * ponytail: updatedAt is each device's own clock, so a clock that is off can pick the older
 * save; a server-side version number would settle it.
 */
export function mergeGoals(local: PlanGoal, remote: PlanGoal | null) {
  if (!remote || remote.status === 'new') return { goal: local, push: local.status !== 'new' };
  if (local.status === 'new' || remote.updatedAt >= local.updatedAt) return { goal: remote, push: false };
  return { goal: local, push: true };
}

/**
 * The saved goal: this account's, else one made before signing in, else a new one
 * that keeps the old "n a day" picker value. A guest plan moves to the first account
 * that signs in here, once, so later accounts on this browser start fresh.
 */
export function loadGoal(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  userId?: string | null,
) {
  try {
    let saved = storage.getItem(planStorageKey(userId));
    if (saved === null && userId) {
      saved = storage.getItem(planStorageKey());
      if (saved !== null) {
        storage.setItem(planStorageKey(userId), saved);
        storage.removeItem(planStorageKey());
      }
    }
    if (saved) return normalizeGoal(JSON.parse(saved));
    return normalizeGoal({
      ...DEFAULT_GOAL,
      dailyTarget: Number(storage.getItem(LEGACY_TARGET_KEY)),
    });
  } catch {
    return DEFAULT_GOAL;
  }
}

/** Today's target from TODAY_TARGET_KEY (0 on a mock OA or OA day), else the old "n a day". */
export function readTodayTarget(storage: Pick<Storage, 'getItem'>, today: string) {
  try {
    const saved = JSON.parse(storage.getItem(TODAY_TARGET_KEY) ?? 'null') as {
      date?: unknown;
      n?: unknown;
    } | null;
    if (saved?.date === today && Number.isInteger(saved.n) && (saved.n as number) >= 0 && (saved.n as number) <= 99)
      return saved.n as number;
    const legacy = Number(storage.getItem(LEGACY_TARGET_KEY));
    return DAILY_TARGETS.includes(legacy) ? legacy : DEFAULT_GOAL.dailyTarget;
  } catch {
    return DEFAULT_GOAL.dailyTarget;
  }
}

/** Assume about half the problems solved elsewhere cover the line's opening stops. */
export function suggestStartStop(totals: readonly number[], solvedBefore: number) {
  if (!(solvedBefore > 0)) return 0;
  let covered = solvedBefore / 2;
  for (let i = 0; i < totals.length; i++) {
    if (covered < totals[i]) return i;
    covered -= totals[i];
  }
  return Math.max(0, totals.length - 1);
}

/** Is the OA date one the card accepts: today up to MAX_DAYS ahead? */
export const oaDateInRange = (date: string, today: string) =>
  isDay(date) && daysBetween(today, date) >= 0 && daysBetween(today, date) <= MAX_DAYS;

/** Does the goal's difficulty and topic filter keep this problem? */
export function planned(goal: PlanGoal, problem: PlanProblem) {
  const slug = problem.stop === undefined ? undefined : ROUTE_SLUGS[problem.stop];
  return (
    goal.difficulties.includes(slotOf(problem.difficulty?.toLowerCase()) ?? 'medium') &&
    (!goal.topics.length || (!!slug && goal.topics.includes(slug)))
  );
}

const byStop = (problems: readonly PlanProblem[]) => {
  const groups = new Map<number | undefined, PlanProblem[]>();
  for (const p of problems) groups.set(p.stop, [...(groups.get(p.stop) ?? []), p]);
  return groups;
};

/**
 * n of the problems, still covering every stop: each stop's share follows its size
 * (one each first, in order), and a stop keeps its foundation-stage, then lower-rated
 * problems, then the line's order. The kept problems stay in their given order.
 */
export function fitPlan(problems: readonly PlanProblem[], n: number) {
  const lists = [...byStop(problems).values()];
  const taken = lists.map(() => 0);
  for (let k = 0; k < n; k++) {
    let best = -1;
    lists.forEach((list, i) => {
      if (taken[i] < list.length && (best < 0 || taken[i] / list.length < taken[best] / lists[best].length))
        best = i;
    });
    if (best < 0) break;
    taken[best]++;
  }
  const keep = new Set(
    lists.flatMap((list, i) =>
      list
        .toSorted((a, b) => (a.stage ?? 1) - (b.stage ?? 1) || (a.rating ?? 1e9) - (b.rating ?? 1e9))
        .slice(0, taken[i]),
    ),
  );
  return problems.filter((p) => keep.has(p));
}

/**
 * The problems mixed across stops: up to MIX stops ride together, one problem each in
 * turn, so a week holds several topics. A stop joins once each of its prerequisites
 * (lib/route-stops.ts STOP_PREREQS) that is in the plan has shown up, so it first appears
 * after them; the earliest such stop joins, or with `shuffle` a pseudo-random one.
 */
export function mixPlan(problems: readonly PlanProblem[], shuffle = 0) {
  const groups = byStop(problems);
  const pending = [...groups.entries()];
  const prereqs = (stop: number | undefined) =>
    stop === undefined
      ? []
      : stopPrereqs(ROUTE_SLUGS[stop] ?? '')
          .map((slug) => ROUTE_SLUGS.indexOf(slug))
          .filter((index) => groups.has(index));
  const started = new Set<number | undefined>();
  const riding: typeof pending = [];
  const mixed: PlanProblem[] = [];
  for (let joined = 0; mixed.length < problems.length; ) {
    while (riding.length < MIX) {
      const ready = pending.filter(([stop]) => prereqs(stop).every((p) => started.has(p)));
      if (!ready.length) break;
      const pick = ready[shuffle ? (Math.imul(shuffle + joined++, 2654435761) >>> 0) % ready.length : 0];
      pending.splice(pending.indexOf(pick), 1);
      riding.push(pick);
    }
    for (const group of riding.slice()) {
      mixed.push(group[1].shift()!);
      started.add(group[0]);
      if (!group[1].length) riding.splice(riding.indexOf(group), 1);
    }
  }
  return mixed;
}

/** The bank's list of a company's most reported problems. */
export const reportedHref = (slug: string) =>
  `/?${new URLSearchParams({ view: 'problems', company: slug, sort: 'frequency' })}`;

/** Days a tracker date wants to sprint: 3 before an OA or a phone screen, 5 before an onsite. */
export const sprintWant = (event: PlanEvent) => (event.onsite ? 5 : 3);

/**
 * The tracker's dates from today through horizonEnd, each with its sprint days: a day
 * (from today on) goes to the nearest date after it that wants it (sprintWant), dates on
 * one day take turns, and a date's own day never sprints. A sprint left with fewer than
 * 2 days is tight; neighbours merge when either is tight and the earlier date falls in
 * the later one's window.
 */
export function trackerSprints(events: readonly PlanEvent[], today: string, horizonEnd: string): SprintGroup[] {
  const sprints: PlanSprint[] = events
    .filter((e) => e.date >= today && e.date <= horizonEnd)
    .toSorted((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({ ...e, days: [] }));
  if (!sprints.length) return [];
  const dates = new Set(sprints.map((s) => s.date));
  const turns = new Map<string, number>();
  const first = addDays(sprints[0].date, -5);
  for (let date = first > today ? first : today; date < sprints.at(-1)!.date; date = addDays(date, 1)) {
    if (dates.has(date)) continue;
    const wanting = sprints.filter((s) => s.date > date && daysBetween(date, s.date) <= sprintWant(s));
    if (!wanting.length) continue;
    const nearest = wanting.filter((s) => s.date === wanting[0].date);
    const turn = turns.get(nearest[0].date) ?? 0;
    turns.set(nearest[0].date, turn + 1);
    nearest[turn % nearest.length].days.push(date);
  }
  const groups: SprintGroup[] = [];
  for (const s of sprints) {
    const group = groups.at(-1);
    const prev = group?.events.at(-1);
    const tight = s.days.length < 2;
    if (group && prev && (tight || prev.days.length < 2) && daysBetween(prev.date, s.date) <= sprintWant(s)) {
      group.events.push(s);
      group.tight = true;
    } else groups.push({ events: [s], days: [], tight });
  }
  for (const group of groups) group.days = group.events.flatMap((s) => s.days).sort();
  return groups;
}

/**
 * Todo = the pool's unsolved problems (Line 500 from goal.startStop on, or a classic
 * list's) under the goal's difficulty and topic filters, mixed across stops (mixPlan),
 * then the target company's unsolved OA problems. With D days to the OA, the days
 * before the last week ride the line only:
 * daily = min(ceil(line / (D - 7)), weekly budget / average minutes), at least 1.
 * The last 7 days hold two mock OAs, at D-5 and D-2 (one when fewer than 3 days
 * are left), and save the company's problems for the rest, ceil(company / those
 * days) a day within the budget; the line fills in once they run out.
 * Without a date (or a past or > 365-day one) the budget sets the pace, line first,
 * over goal.weeks. When the days cannot hold the line, fitPlan keeps what they can,
 * spread over every stop, instead of cutting the last stops.
 * `done` counts the problems of each kind solved earlier today: paces count from
 * this morning, so working off today's problems does not lower today's goal.
 * The tracker's dates (trackerSprints) fill the days before the last week, or goal.weeks:
 * a sprint's days share its company's problems (`tracker.problems` by preset),
 * min(budget, ceil(problems / days)) a day, and ride the line once none are left; a
 * sprint of 3+ days with a preset holds a mock OA the day before, and the date itself
 * takes nothing. The line's pace counts the other days only.
 */
export function buildPlan({
  goal,
  today,
  line,
  company: targetCompany = [],
  done = {},
  tracker,
}: {
  goal: PlanGoal;
  today: string;
  line: readonly PlanProblem[];
  company?: readonly PlanProblem[];
  done?: { line?: number; company?: number };
  tracker?: { events: readonly PlanEvent[]; problems?: ReadonlyMap<string, readonly PlanProblem[]> };
}): Plan {
  const d = goal.oaDate && isDay(goal.oaDate) ? daysBetween(today, goal.oaDate) : null;
  const daysLeft = d !== null && d >= 0 && d <= MAX_DAYS ? d : null;
  const from = goal.pool === 'line' ? goal.startStop : 0;
  const ahead = line.filter((p) => (p.stop ?? 0) >= from);
  const wanted = ahead.filter((p) => planned(goal, p));
  // ponytail: the average leaves out today's solved problems (their difficulty is
  // not sent), so the budget can shift by one when they differ a lot from the rest.
  // It also counts problems a short plan cuts.
  const all = wanted.length + targetCompany.length;
  const avgMinutes = all
    ? [...wanted, ...targetCompany].reduce((sum, p) => sum + minutesFor(p.difficulty), 0) / all
    : MINUTES.medium;
  const budget = Math.max(1, Math.floor((goal.weeklyHours * 60) / 7 / avgMinutes));
  const sprintFrom = daysLeft === null ? Infinity : Math.max(0, daysLeft - SPRINT_DAYS);
  const sprintDays = daysLeft === null ? 0 : daysLeft - sprintFrom;
  const mockDays = sprintDays
    ? [...new Set([Math.max(0, sprintDays - 5), Math.max(0, sprintDays - 2)])].map(
        (k) => sprintFrom + k,
      )
    : [];
  const doneToday = (done.line ?? 0) + (done.company ?? 0);
  const pace = (left: number, days: number) =>
    left ? Math.min(Math.ceil(left / Math.max(1, days)), budget) : 0;
  // The tracker's days, laid out before the line: they end before the OA's last week.
  const end = addDays(today, (daysLeft === null ? goal.weeks * 7 : sprintFrom) - 1);
  const events = tracker?.events ?? [];
  const sprints = trackerSprints(events, today, end);
  const marked = new Map<string, Pick<PlanDay, 'problems' | 'sprintFor' | 'event' | 'mock'>>();
  const used = new Set<string>();
  for (const s of sprints.flatMap((group) => group.events)) {
    // ponytail: two dates on one day mark the day with the first; the sprints still split for both.
    if (!marked.has(s.date)) marked.set(s.date, { problems: [], event: s });
    const days = [...s.days];
    if (s.preset && days.length >= 3 && days.at(-1) === addDays(s.date, -1))
      marked.set(days.pop()!, { problems: [], sprintFor: s, mock: 1 });
    const queue = (s.preset ? (tracker?.problems?.get(s.preset) ?? []) : []).filter((p) => !used.has(p.id));
    const n = pace(queue.length, days.length);
    let q = 0;
    for (const date of days) {
      const problems = queue.slice(q, q + Math.max(0, n - (date === today ? doneToday : 0)));
      q += problems.length;
      for (const p of problems) used.add(p.id);
      marked.set(date, { problems, sprintFor: s });
    }
  }
  const busy = [...marked.values()].filter((m) => m.event || m.mock || m.problems.length).length;
  // The OA's own sprint skips what a tracker sprint already planned.
  const company = targetCompany.filter((p) => !used.has(p.id));
  const companyLeft = company.length + (done.company ?? 0);
  const companyPace = pace(companyLeft, sprintDays - mockDays.length);
  const schedule = (queue: readonly PlanProblem[]) => {
    const lineLeft = queue.length + (done.line ?? 0);
    const linePace =
      daysLeft === null
        ? lineLeft + companyLeft
          ? budget
          : 0
        : pace(lineLeft, daysLeft - SPRINT_DAYS - busy);
    let l = 0,
      c = 0;
    const days: PlanDay[] = [];
    for (let i = 0; i < (daysLeft === null ? goal.weeks * 7 : daysLeft + 1); i++) {
      const date = addDays(today, i);
      if (i === daysLeft) {
        days.push({ date, problems: [], minutes: 0, sprint: true, oa: true });
        continue;
      }
      const mark = marked.get(date);
      const solved = i ? 0 : doneToday;
      if (mark && (mark.event || mark.mock || mark.problems.length)) {
        days.push({
          date,
          sprint: false,
          ...mark,
          minutes: mark.mock
            ? mark.sprintFor!.minutes
            : Math.round(mark.problems.reduce((sum, p) => sum + minutesFor(p.difficulty), 0) + solved * avgMinutes),
          ...(solved && !mark.event && !mark.mock ? { done: solved } : {}),
        });
        continue;
      }
      const sprint = i >= sprintFrom;
      const mock = mockDays.indexOf(i) + 1;
      if (mock) {
        days.push({ date, problems: [], minutes: goal.company?.minutes ?? 90, sprint, mock });
        continue;
      }
      // A sprint day goes to the company while its problems last (today: while any
      // were left this morning).
      const companyDay = sprint && (i ? c < company.length : companyLeft > 0);
      const next = () =>
        companyDay
          ? (company[c++] ?? queue[l++])
          : daysLeft === null
            ? (queue[l++] ?? company[c++])
            : queue[l++];
      const problems: PlanProblem[] = [];
      for (let k = solved; k < (companyDay ? companyPace : linePace); k++) {
        const problem = next();
        if (!problem) break; // Nothing left to plan.
        problems.push(problem);
      }
      days.push({
        date,
        problems,
        minutes: Math.round(
          problems.reduce((sum, p) => sum + minutesFor(p.difficulty), 0) + solved * avgMinutes,
        ),
        sprint,
        ...(solved ? { done: solved } : {}),
        // A tracker sprint without its company's problems rides the line.
        ...(mark?.sprintFor ? { sprintFor: mark.sprintFor } : {}),
      });
    }
    return { days, linePace, planned: Math.min(l, queue.length) };
  };
  let queue = mixPlan(wanted, goal.shuffle);
  let run = schedule(queue);
  // Too much for the days: keep what they hold, over every stop, and lay it out again.
  // (No room at all, as on the OA day, leaves the queue whole.)
  if (run.planned && run.planned < queue.length) {
    queue = mixPlan(fitPlan(wanted, run.planned), goal.shuffle);
    run = schedule(queue);
  }
  const first = run.days[0];
  return {
    daysLeft,
    expired: d !== null && d < 0,
    todo: all,
    avgMinutes,
    daily: first?.sprintFor && !first.mock
      ? first.problems.length + (first.done ?? 0)
      : sprintFrom === 0 && companyLeft
        ? companyPace
        : run.linePace,
    days: run.days,
    filtered: ahead.length - wanted.length,
    cut: wanted.length - queue.length,
    sprints,
    // The OA day itself is most likely that same OA on the tracker.
    skipped: daysLeft === null ? 0 : events.filter((e) => e.date > end && e.date < goal.oaDate).length,
  };
}

/** Calendar weeks (Monday first) of a plan's days. */
export function planWeeks(days: readonly PlanDay[]): PlanWeek[] {
  const weeks: PlanWeek[] = [];
  for (const day of days) {
    let week = weeks.at(-1);
    if (!week || weekday(day.date) === 0) {
      week = {
        start: day.date,
        end: day.date,
        days: [],
        problems: 0,
        minutes: 0,
        mocks: 0,
        sprint: false,
        oa: false,
        stops: [],
      };
      weeks.push(week);
    }
    week.end = day.date;
    week.days.push(day);
    week.problems += day.problems.length + (day.done ?? 0);
    week.minutes += day.minutes;
    week.mocks += day.mock ? 1 : 0;
    week.sprint ||= day.sprint;
    week.oa ||= !!day.oa;
    for (const { stop } of day.problems)
      if (stop !== undefined && !week.stops.includes(stop)) week.stops.push(stop);
  }
  return weeks;
}

/** The plan's week list can group by week (planWeeks), stop or difficulty; this browser remembers. */
export type PlanGroupBy = 'week' | 'topic' | 'difficulty';
export type PlanOrder = 'plan' | 'difficulty';
export const PLAN_VIEW_KEY = 'cswork:plan:view';
const LEVELS = ['easy', 'medium', 'hard'] as const;
export type PlanGroup = {
  key: string;
  /** The stop (topic grouping); null off the line (key 'oa:<tracker company>' or 'other'). */
  stop: number | null;
  /** An 'oa:' group's tracker company; null for the target company's (or no) OA problems. */
  company: string | null;
  level: (typeof LEVELS)[number] | null;
  problems: number;
  minutes: number;
  first: string;
  last: string;
};
/**
 * The plan's problems by stop or by difficulty, with their count, minutes and first and
 * last day. Stops come in plan order, or easiest first (mean level, ties in plan order);
 * difficulty groups always run easy → hard.
 */
export function planGroups(days: readonly PlanDay[], by: 'topic' | 'difficulty', order: PlanOrder = 'plan') {
  const groups = new Map<string, PlanGroup>();
  // Sum of level indices per group, for the mean.
  const levels = new Map<string, number>();
  for (const day of days)
    for (const problem of day.problems) {
      const level = slotOf(problem.difficulty?.toLowerCase()) ?? 'medium';
      // Off the line: OA problems by company (a tracker sprint's, else the target's), or a classic list's others.
      const oa = by === 'topic' && problem.stop == null && problem.id.startsWith('oa-');
      const company = oa ? (day.sprintFor?.company ?? null) : null;
      const key = by === 'difficulty' ? level : oa ? `oa:${company ?? ''}` : String(problem.stop ?? 'other');
      const group = groups.get(key) ?? {
        key,
        stop: by === 'topic' ? (problem.stop ?? null) : null,
        company,
        level: by === 'difficulty' ? level : null,
        problems: 0,
        minutes: 0,
        first: day.date,
        last: day.date,
      };
      group.problems++;
      group.minutes += minutesFor(problem.difficulty);
      group.last = day.date;
      levels.set(key, (levels.get(key) ?? 0) + LEVELS.indexOf(level));
      groups.set(key, group);
    }
  const list = [...groups.values()];
  if (by === 'difficulty') list.sort((a, b) => LEVELS.indexOf(a.level!) - LEVELS.indexOf(b.level!));
  else if (order === 'difficulty')
    list.sort((a, b) => levels.get(a.key)! / a.problems - levels.get(b.key)! / b.problems);
  return list;
}

const compact = (date: string) => date.replaceAll('-', '');

/**
 * The plan as an iCalendar file: daily practice series before and in the sprint
 * (floating local time, so they ring at `time` wherever the learner is), the mock
 * OA days, the OA day, and a series (and mock OA) for each tracker sprint.
 * UIDs are fixed, so importing an updated plan replaces the old events.
 */
export function planIcs({
  plan,
  goal,
  now,
  origin,
  english = false,
  time = '20:00',
}: {
  plan: Plan;
  goal: PlanGoal;
  now: Date;
  origin: string;
  english?: boolean;
  time?: string;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const at = (date: string) => `${compact(date)}T${time.replace(':', '')}00`;
  const events: string[][] = [];
  const event = (uid: string, fields: string[], trigger: string, note: string) =>
    events.push(vevent(`cswork-plan-${uid}@cswork.org`, now, fields, { trigger, note }));
  const company = goal.company;
  const problems = (n: number) => t(`${n} 题`, `${n} ${n === 1 ? 'problem' : 'problems'}`);
  // A daily series over the days that have problems, the ones between skipped.
  const series = (uid: string, practice: PlanDay[], summary: (n: string) => string, path = '/?view=problems') => {
    if (!practice.length) return;
    const first = practice[0].date,
      last = practice.at(-1)!.date;
    const skip = plan.days.filter(
      (day) => day.date > first && day.date < last && !practice.includes(day),
    );
    // ponytail: a series names its first day's count; the run's last days can
    // hold fewer, or the line's pace once the company's problems run out.
    const n = practice[0].problems.length + (practice[0].done ?? 0);
    const minutes = Math.round(n * plan.avgMinutes);
    const text = summary(problems(n));
    event(
      uid,
      [
        `DTSTART:${at(first)}`,
        `DURATION:PT${Math.max(15, minutes)}M`,
        `RRULE:FREQ=DAILY;COUNT=${daysBetween(first, last) + 1}`,
        ...(skip.length ? [`EXDATE:${skip.map((day) => at(day.date)).join(',')}`] : []),
        `SUMMARY:${escapeText(text)}`,
        `DESCRIPTION:${escapeText(
          t(
            `按冲刺计划每天 ${n} 题，约 ${minutes} 分钟。`,
            `Your sprint plan: ${n} a day, about ${minutes} minutes.`,
          ),
        )}`,
        `URL:${origin}${path}`,
      ],
      'PT0S',
      text,
    );
  };
  const mock = (uid: string, day: PlanDay, summary: string, path: string) =>
    event(
      uid,
      [
        `DTSTART:${at(day.date)}`,
        `DURATION:PT${day.minutes}M`,
        `SUMMARY:${escapeText(summary)}`,
        `URL:${origin}${path}`,
      ],
      'PT0S',
      summary,
    );
  // One series before the sprint and one in it: their paces differ. Tracker sprint days have their own.
  for (const sprint of [false, true])
    series(
      sprint ? 'sprint' : 'practice',
      plan.days.filter((day) => day.sprint === sprint && day.problems.length && !day.sprintFor),
      (n) =>
        sprint
          ? t(`CSWork 冲刺：${n}${company ? ` · ${company.name}` : ''}`, `CSWork sprint: ${n}${company ? ` · ${company.name}` : ''}`)
          : t(`CSWork 今日行程：${n}`, `CSWork daily trip: ${n}`),
    );
  for (const day of plan.days)
    if (day.mock && !day.sprintFor)
      mock(
        `mock-${day.mock}`,
        day,
        t(
          `CSWork 模拟 OA（第 ${day.mock} 次）${company ? ` · ${company.name}` : ''}`,
          `CSWork mock OA #${day.mock}${company ? ` · ${company.name}` : ''}`,
        ),
        `/mock-oa${company ? `/${company.slug}` : ''}`,
      );
  // Each tracker sprint (and its mock OA) keeps its card's UID, so a moved date replaces it on
  // re-import. The OA and interview themselves are in the tracker's own .ics.
  // ponytail: a deleted card's sprint stays in the calendar until removed there by hand.
  for (const s of plan.sprints.flatMap((group) => group.events)) {
    const uid = `app-${s.id}-${s.kind}`;
    series(
      uid,
      plan.days.filter((day) => day.sprintFor === s && !day.mock && day.problems.length),
      (n) => t(`CSWork 冲刺 ${s.company}：${n}`, `CSWork sprint for ${s.company}: ${n}`),
      s.slug ? reportedHref(s.slug) : undefined,
    );
    const day = plan.days.find((d) => d.sprintFor === s && d.mock);
    if (day) mock(`${uid}-mock`, day, t(`CSWork 模拟 OA · ${s.company}`, `CSWork mock OA · ${s.company}`), `/mock-oa/${s.preset}`);
  }
  const oa = plan.days.find((day) => day.oa);
  if (oa) {
    const summary = t(
      `OA 日${company ? ` · ${company.name}` : ''}`,
      `OA day${company ? ` · ${company.name}` : ''}`,
    );
    event(
      'oa',
      [
        `DTSTART;VALUE=DATE:${compact(oa.date)}`,
        `DTEND;VALUE=DATE:${compact(addDays(oa.date, 1))}`,
        `SUMMARY:${escapeText(summary)}`,
        'TRANSP:TRANSPARENT',
      ],
      // 09:00 the day before.
      '-PT15H',
      summary,
    );
  }
  return calendar(
    [
      'VERSION:2.0',
      'PRODID:-//CSWork//Study Plan//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${escapeText(t('CSWork 冲刺计划', 'CSWork sprint plan'))}`,
    ],
    events,
  );
}
