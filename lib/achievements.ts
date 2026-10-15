// Achievement badges, all computed from practice data (no table). Client-safe.
import { STOP_NAMES } from './route-stops';

export type BadgeGroup =
  | 'stop'
  | 'line'
  | 'streak'
  | 'days'
  | 'company'
  | 'mock'
  | 'contest'
  | 'daily'
  | 'list'
  | 'domain';
export type Badge = {
  id: string;
  group: BadgeGroup;
  zh: string;
  en: string;
  earned: boolean;
  /** Progress toward the badge: [have, need]. */
  progress: [number, number];
};
export type AchievementInput = {
  /** Line 500 stops in line order. */
  stops: readonly { slug: string; solved: number; total: number }[];
  /** Longest streak, streak freezes included (practiceStats' `best`). */
  bestStreak: number;
  /** Every accepted submission time. */
  acTimes: readonly number[];
  /** Companies with judgeable OAs: how many there are and how many are solved. */
  companies: readonly { slug: string; name: string; solved: number; total: number }[];
  perfectMock: boolean;
  /** Rated weekly contests (lib/server/contests.ts); the contest badges appear only when given. */
  contests?: readonly ContestResult[];
  /** Beijing dates whose daily problem was solved on its day (the points ledger); month badges. */
  dailyDays?: readonly string[];
  /** Classic lists (lib/classic-lists.ts classicListProgress), judgeable problems only. */
  lists?: readonly { slug: string; zh: string; en: string; solved: number; total: number }[];
  /** Distinct problems solved: Line 500 (its stops), the SQL track (sql-) and company OAs (oa-). */
  domains?: Domains;
};
export type Domains = { line: number; sql: number; oa: number };
/** One rated weekly: live rank among `entrants`, rating after it, problems solved of `total`. */
export type ContestResult = { rank: number; entrants: number; after: number; solved: number; total: number };

export const STREAK_BADGES = [7, 30, 100] as const;
export const DAY_BADGES = [50, 100] as const;
// ponytail: a company badge needs 3+ judgeable OAs, so one easy OA is no trophy.
export const COMPANY_MIN = 3;

/** The most distinct local days with an AC inside one calendar year. */
export function bestYearDays(times: readonly number[]) {
  const years = new Map<number, Set<string>>();
  for (const time of times) {
    const date = new Date(time);
    const days = years.get(date.getFullYear()) ?? new Set<string>();
    days.add(date.toDateString());
    years.set(date.getFullYear(), days);
  }
  return Math.max(0, ...[...years.values()].map((days) => days.size));
}

/**
 * The longest run of local days with an AC, where one empty day between two AC days is bridged
 * by a streak freeze (up to `freezes` a calendar month), as practiceStats' `best` counts it but
 * over all of time. For server pages, which cannot import the client calendar.
 */
export function longestStreak(times: readonly number[], freezes = 2) {
  const DAY = 86400000;
  // Local noon of each AC day, so whole-day steps stay clear of daylight-saving edges.
  const noon = (time: number) => {
    const d = new Date(time);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime();
  };
  const days = [...new Set(times.map(noon))].sort((a, b) => a - b);
  const used = new Map<string, number>();
  let best = 0,
    run = 0,
    last = -Infinity;
  for (const day of days) {
    const gap = Math.round((day - last) / DAY);
    const gapDay = new Date(day - DAY);
    const month = `${gapDay.getFullYear()}-${gapDay.getMonth()}`;
    if (gap === 1) run++;
    else if (gap === 2 && (used.get(month) ?? 0) < freezes) {
      used.set(month, (used.get(month) ?? 0) + 1);
      run++;
    } else run = 1;
    best = Math.max(best, run);
    last = day;
  }
  return best;
}

const reached = (have: number, need: number): [number, number] => [Math.min(have, need), need];

/** Every badge, earned or not, in wall order. */
export function achievements(input: AchievementInput): Badge[] {
  const badges: Badge[] = input.stops.map((stop) => {
    const [zh, en] = Object.hasOwn(STOP_NAMES, stop.slug)
      ? STOP_NAMES[stop.slug]
      : [stop.slug, stop.slug];
    return {
      id: `stop:${stop.slug}`,
      group: 'stop',
      zh: `${zh}站`,
      en,
      earned: stop.total > 0 && stop.solved >= stop.total,
      progress: reached(stop.solved, stop.total),
    };
  });
  const cleared = badges.filter((badge) => badge.earned).length;
  badges.push({
    id: 'line',
    group: 'line',
    zh: '500 路全线通关',
    en: 'Line 500 complete',
    earned: input.stops.length > 0 && cleared === input.stops.length,
    progress: reached(cleared, input.stops.length),
  });
  for (const n of STREAK_BADGES)
    badges.push({
      id: `streak:${n}`,
      group: 'streak',
      zh: `连续 ${n} 天`,
      en: `${n}-day streak`,
      earned: input.bestStreak >= n,
      progress: reached(input.bestStreak, n),
    });
  const days = bestYearDays(input.acTimes);
  for (const n of DAY_BADGES)
    badges.push({
      id: `days:${n}`,
      group: 'days',
      zh: `一年 ${n} 天`,
      en: `${n} days in a year`,
      earned: days >= n,
      progress: reached(days, n),
    });
  for (const company of input.companies)
    if (company.total >= COMPANY_MIN)
      badges.push({
        id: `company:${company.slug}`,
        group: 'company',
        zh: `${company.name} OA 全通`,
        en: `${company.name} OA cleared`,
        earned: company.solved >= company.total,
        progress: reached(company.solved, company.total),
      });
  badges.push({
    id: 'mock:perfect',
    group: 'mock',
    zh: '首次模拟 OA 满分',
    en: 'First perfect mock OA',
    earned: input.perfectMock,
    progress: [Number(input.perfectMock), 1],
  });
  if (input.domains) badges.push(...domainBadges(input.domains));
  if (input.dailyDays) badges.push(...monthBadges(input.dailyDays));
  for (const list of input.lists ?? [])
    if (list.total > 0)
      badges.push({
        id: `list:${list.slug}`,
        group: 'list',
        zh: `${list.zh}通关`,
        en: `${list.en} cleared`,
        earned: list.solved >= list.total,
        progress: reached(list.solved, list.total),
      });
  if (input.contests) badges.push(...contestBadges(input.contests));
  return badges;
}

/** Solved counts for 1 to 5 stars in each domain. */
export const DOMAIN_STARS: Record<keyof Domains, readonly number[]> = {
  line: [10, 50, 150, 300, 500],
  sql: [5, 15, 30, 40, 50],
  oa: [5, 20, 50, 100, 200],
};
const DOMAIN_NAMES: Record<keyof Domains, [string, string]> = {
  line: ['算法', 'Algorithms'],
  sql: ['SQL', 'SQL'],
  oa: ['公司 OA', 'Company OA'],
};
/** One badge per domain: earned at the first star, its progress toward the next (or the last). */
export function domainBadges(domains: Domains): Badge[] {
  return (Object.keys(DOMAIN_STARS) as (keyof Domains)[]).map((key): Badge => {
    const steps = DOMAIN_STARS[key];
    const stars = steps.filter((n) => domains[key] >= n).length;
    const [zh, en] = DOMAIN_NAMES[key];
    return {
      id: `domain:${key}`,
      group: 'domain',
      zh: stars ? `${zh} ${stars} 星` : `${zh}星级`,
      en: stars ? `${en} · ${stars} ${stars === 1 ? 'star' : 'stars'}` : `${en} stars`,
      earned: stars > 0,
      progress: reached(domains[key], steps[Math.min(stars, steps.length - 1)]),
    };
  });
}

/** Days in a YYYY-MM month. */
export const monthDays = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
/**
 * A daily problem every day of a Beijing month, newest first: every month won stays, and the
 * latest 12 months with any daily problem show their progress.
 */
export function monthBadges(days: readonly string[]): Badge[] {
  const months = new Map<string, number>();
  for (const day of new Set(days)) months.set(day.slice(0, 7), (months.get(day.slice(0, 7)) ?? 0) + 1);
  const recent = new Set([...months.keys()].sort().slice(-12));
  return [...months]
    .sort(([a], [b]) => b.localeCompare(a))
    .flatMap(([month, n]) => {
      const need = monthDays(month);
      if (n < need && !recent.has(month)) return [];
      const [y, m] = month.split('-').map(Number);
      const en = new Date(Date.UTC(y, m - 1, 15)).toLocaleString('en', { month: 'short', timeZone: 'UTC' });
      return [
        {
          id: `daily:${month}`,
          group: 'daily' as const,
          zh: `${y} 年 ${m} 月每日一题全勤`,
          en: `Daily problem every day, ${en} ${y}`,
          earned: n >= need,
          progress: reached(n, need),
        },
      ];
    });
}

export const CONTEST_REGULAR = 10;
/** A podium counts in a weekly of at least this many rated entrants. */
export const PODIUM_MIN = 10;
export const RAPID_RATING = 1850;

/** The weekly contest's badges, in our own names (the Line 500 train classes). */
export function contestBadges(results: readonly ContestResult[]): Badge[] {
  const badge = (id: string, zh: string, en: string, have: number, need = 1): Badge => ({
    id: `contest:${id}`,
    group: 'contest',
    zh,
    en,
    earned: have >= need,
    progress: reached(have, need),
  });
  const any = (test: (r: ContestResult) => boolean) => Number(results.some(test));
  return [
    badge('first', '首次发车', 'First departure', results.length),
    badge('regular', `周赛常客 ${CONTEST_REGULAR} 场`, `${CONTEST_REGULAR} weeklies`, results.length, CONTEST_REGULAR),
    badge('sweep', '全线贯通', 'Full line', any((r) => r.total > 0 && r.solved >= r.total)),
    badge('podium', '前三进站', 'Podium finish', any((r) => r.rank <= 3 && r.entrants >= PODIUM_MIN)),
    badge(
      'rapid',
      '直达段位',
      'Rapid class',
      any((r) => r.after >= RAPID_RATING && r.rank <= Math.ceil(r.entrants / 4)),
    ),
  ];
}

/** Badges earned in `after` that were not earned in `before`. */
export function newlyEarned(before: readonly Badge[], after: readonly Badge[]) {
  const had = new Set(before.flatMap((badge) => (badge.earned ? [badge.id] : [])));
  return after.filter((badge) => badge.earned && !had.has(badge.id));
}
