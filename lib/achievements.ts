// Achievement badges, all computed from practice data (no table). Client-safe.
import { STOP_NAMES } from './route-stops';

export type BadgeGroup = 'stop' | 'line' | 'streak' | 'days' | 'company' | 'mock';
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
};

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
  return badges;
}

/** Badges earned in `after` that were not earned in `before`. */
export function newlyEarned(before: readonly Badge[], after: readonly Badge[]) {
  const had = new Set(before.flatMap((badge) => (badge.earned ? [badge.id] : [])));
  return after.filter((badge) => badge.earned && !had.has(badge.id));
}
