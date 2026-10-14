// Achievement badges, all computed from practice data (no table). Client-safe.
import { STOP_NAMES } from './route-stops';

export type BadgeGroup = 'stop' | 'line' | 'streak' | 'days' | 'company' | 'mock' | 'contest';
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
};
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
  if (input.contests) badges.push(...contestBadges(input.contests));
  return badges;
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
