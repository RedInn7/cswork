/**
 * Sprint plan: count back from an OA date to a daily trip on the 500 line.
 * Pure (days are local 'YYYY-MM-DD' strings) and shared by the bank page and its
 * tests. v1 keeps the goal in this browser only (planStorageKey), like the mock
 * OA history; syncing it across devices needs a table.
 */
import { slotOf } from './mock-oa';

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
};
/** One problem left to do; stop is its 0-based stop on the line (OA problems have none). */
export type PlanProblem = { id: string; difficulty?: string | null; stop?: number };
export type PlanDay = {
  date: string;
  problems: PlanProblem[];
  minutes: number;
  /** The last week before the OA: target-company problems first. */
  sprint: boolean;
  /** 1 or 2 on a mock OA day, which has no other problems. */
  mock?: number;
  oa?: boolean;
};
export type Plan = {
  /** Days until the OA (0 = today), or null without a usable date. */
  daysLeft: number | null;
  /** The saved OA date has passed; the plan runs open-ended until it is changed. */
  expired: boolean;
  todo: number;
  avgMinutes: number;
  daily: number;
  /** Today through the OA day, or OPEN_DAYS without a date. */
  days: PlanDay[];
};
export type PlanWeek = {
  start: string;
  end: string;
  days: PlanDay[];
  problems: number;
  minutes: number;
  mocks: number;
  sprint: boolean;
  oa: boolean;
  /** First and last stop of the week's line problems, if any. */
  stops: [number, number] | null;
};

export const MINUTES = { easy: 15, medium: 25, hard: 40 } as const;
export const SPRINT_DAYS = 7;
export const MAX_DAYS = 365;
export const OPEN_DAYS = 28;
export const DAILY_TARGETS = [1, 2, 3, 5];
export const LEGACY_TARGET_KEY = 'cswork:practice:daily-target';
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
const weekday = (date: string) => (new Date(dayNumber(date) * DAY).getUTCDay() + 6) % 7;

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
  };
}

/**
 * The saved goal: this account's, else one made before signing in, else a new one
 * that keeps the old "n a day" picker value.
 */
export function loadGoal(storage: Pick<Storage, 'getItem'>, userId?: string | null) {
  try {
    const saved =
      storage.getItem(planStorageKey(userId)) ??
      (userId ? storage.getItem(planStorageKey()) : null);
    if (saved) return normalizeGoal(JSON.parse(saved));
    return normalizeGoal({
      ...DEFAULT_GOAL,
      dailyTarget: Number(storage.getItem(LEGACY_TARGET_KEY)),
    });
  } catch {
    return DEFAULT_GOAL;
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

/**
 * Todo = the line's unsolved problems from goal.startStop on (in sequence), then
 * the target company's unsolved OA problems. With D days to the OA:
 * daily = min(ceil(todo / (D - 7)), weekly budget / average minutes), at least 1.
 * The last 7 days take company problems first (the line once they run out) and
 * hold two mock OAs, at D-5 and D-2 (one when fewer than 3 days are left).
 * Without a date (or a past or > 365-day one) the budget sets the pace.
 */
export function buildPlan({
  goal,
  today,
  line,
  company = [],
}: {
  goal: PlanGoal;
  today: string;
  line: readonly PlanProblem[];
  company?: readonly PlanProblem[];
}): Plan {
  const d = goal.oaDate && isDay(goal.oaDate) ? daysBetween(today, goal.oaDate) : null;
  const daysLeft = d !== null && d >= 0 && d <= MAX_DAYS ? d : null;
  const queue = line.filter((p) => (p.stop ?? 0) >= goal.startStop);
  const todo = queue.length + company.length;
  const avgMinutes = todo
    ? [...queue, ...company].reduce((sum, p) => sum + minutesFor(p.difficulty), 0) / todo
    : MINUTES.medium;
  const budget = Math.max(1, Math.floor((goal.weeklyHours * 60) / 7 / avgMinutes));
  const daily = !todo
    ? 0
    : daysLeft === null
      ? budget
      : Math.min(Math.ceil(todo / Math.max(1, daysLeft - SPRINT_DAYS)), budget);
  const sprintFrom = daysLeft === null ? Infinity : Math.max(0, daysLeft - SPRINT_DAYS);
  const sprintDays = daysLeft === null ? 0 : daysLeft - sprintFrom;
  const mockDays = sprintDays
    ? [...new Set([Math.max(0, sprintDays - 5), Math.max(0, sprintDays - 2)])].map(
        (k) => sprintFrom + k,
      )
    : [];
  let l = 0,
    c = 0;
  const next = (companyFirst: boolean) =>
    companyFirst
      ? (company[c++] ?? queue[l++])
      : (queue[l++] ?? company[c++]);
  const days: PlanDay[] = [];
  for (let i = 0; i < (daysLeft === null ? OPEN_DAYS : daysLeft + 1); i++) {
    const date = addDays(today, i);
    if (i === daysLeft) {
      days.push({ date, problems: [], minutes: 0, sprint: true, oa: true });
      continue;
    }
    const sprint = i >= sprintFrom;
    const mock = mockDays.indexOf(i) + 1;
    if (mock) {
      days.push({ date, problems: [], minutes: goal.company?.minutes ?? 90, sprint, mock });
      continue;
    }
    const problems: PlanProblem[] = [];
    for (let k = 0; k < daily; k++) {
      if (l >= queue.length && c >= company.length) break; // Nothing left to plan.
      problems.push(next(sprint)!);
    }
    days.push({
      date,
      problems,
      minutes: problems.reduce((sum, p) => sum + minutesFor(p.difficulty), 0),
      sprint,
    });
  }
  return {
    daysLeft,
    expired: d !== null && d < 0,
    todo,
    avgMinutes,
    daily,
    days,
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
        stops: null,
      };
      weeks.push(week);
    }
    week.end = day.date;
    week.days.push(day);
    week.problems += day.problems.length;
    week.minutes += day.minutes;
    week.mocks += day.mock ? 1 : 0;
    week.sprint ||= day.sprint;
    week.oa ||= !!day.oa;
    for (const { stop } of day.problems)
      if (stop !== undefined)
        week.stops = week.stops ? [week.stops[0], stop] : [stop, stop];
  }
  return weeks;
}

// RFC 5545 text: escape, then fold to 75 octets with CRLF + space.
const escapeText = (text: string) =>
  text.replace(/[\\;,]/g, '\\$&').replace(/\r?\n/g, '\\n');
function fold(line: string) {
  const parts: string[] = [];
  let part = '',
    size = 0;
  for (const ch of line) {
    const cp = ch.codePointAt(0)!;
    const bytes = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
    if (size + bytes > (parts.length ? 74 : 75)) {
      parts.push(part);
      part = '';
      size = 0;
    }
    part += ch;
    size += bytes;
  }
  parts.push(part);
  return parts.join('\r\n ');
}
const compact = (date: string) => date.replaceAll('-', '');
const utcStamp = (now: Date) =>
  now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/**
 * The plan as an iCalendar file: one daily practice series (floating local time,
 * so it rings at `time` wherever the learner is), the mock OA days and the OA day.
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
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CSWork//Study Plan//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(t('CSWork 冲刺计划', 'CSWork sprint plan'))}`,
  ];
  const event = (uid: string, fields: string[], alarm: string, note: string) =>
    lines.push(
      'BEGIN:VEVENT',
      `UID:cswork-plan-${uid}@cswork.org`,
      `DTSTAMP:${utcStamp(now)}`,
      ...fields,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(note)}`,
      `TRIGGER:${alarm}`,
      'END:VALARM',
      'END:VEVENT',
    );
  const practice = plan.days.filter((day) => day.problems.length);
  if (practice.length) {
    const first = practice[0].date,
      last = practice.at(-1)!.date;
    const skip = plan.days.filter(
      (day) => day.date > first && day.date < last && !day.problems.length,
    );
    const summary = t(
      `CSWork 今日行程：${plan.daily} 题`,
      `CSWork daily trip: ${plan.daily} ${plan.daily === 1 ? 'problem' : 'problems'}`,
    );
    event(
      'practice',
      [
        `DTSTART:${at(first)}`,
        `DURATION:PT${Math.max(15, Math.round(plan.daily * plan.avgMinutes))}M`,
        `RRULE:FREQ=DAILY;COUNT=${daysBetween(first, last) + 1}`,
        ...(skip.length ? [`EXDATE:${skip.map((day) => at(day.date)).join(',')}`] : []),
        `SUMMARY:${escapeText(summary)}`,
        `DESCRIPTION:${escapeText(
          t(
            `按冲刺计划每天 ${plan.daily} 题，约 ${Math.round(plan.daily * plan.avgMinutes)} 分钟。`,
            `Your sprint plan: ${plan.daily} a day, about ${Math.round(plan.daily * plan.avgMinutes)} minutes.`,
          ),
        )}`,
        `URL:${origin}/?view=problems`,
      ],
      'PT0S',
      summary,
    );
  }
  const company = goal.company;
  for (const day of plan.days)
    if (day.mock) {
      const summary = t(
        `CSWork 模拟 OA（第 ${day.mock} 次）${company ? ` · ${company.name}` : ''}`,
        `CSWork mock OA #${day.mock}${company ? ` · ${company.name}` : ''}`,
      );
      event(
        `mock-${day.mock}`,
        [
          `DTSTART:${at(day.date)}`,
          `DURATION:PT${day.minutes}M`,
          `SUMMARY:${escapeText(summary)}`,
          `URL:${origin}/mock-oa${company ? `/${company.slug}` : ''}`,
        ],
        'PT0S',
        summary,
      );
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
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
