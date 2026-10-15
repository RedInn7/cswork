import { longestStreak } from './achievements';

const DAY = 86400000;
type Activity = { problem_id: string; created_at: number };
export type YearCell = { time: number; count: number; future: boolean } | null;

/**
 * One local calendar year of accepted problems, weeks starting on Monday: `cells` column by
 * column, null where the first and last weeks reach into the years around it. Activity outside
 * the local year is ignored (the server pads its UTC year for every time zone). `now` marks the
 * days still ahead; the busiest day is the first of the most solved.
 */
export function yearRecap(activity: readonly Activity[], year: number, now: number, english: boolean) {
  const first = new Date(year, 0, 1, 12).getTime();
  // Local noons, so whole-day steps stay clear of daylight-saving edges.
  const index = (time: number) => {
    const d = new Date(time);
    return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime() - first) / DAY);
  };
  const byDay = new Map<number, Set<string>>();
  const solved = new Set<string>();
  const times: number[] = [];
  for (const a of activity) {
    if (new Date(a.created_at).getFullYear() !== year) continue;
    const i = index(a.created_at);
    byDay.set(i, (byDay.get(i) ?? new Set()).add(a.problem_id));
    solved.add(a.problem_id);
    times.push(a.created_at);
  }
  const days = index(new Date(year, 11, 31, 12).getTime()) + 1;
  const lead = (new Date(year, 0, 1).getDay() + 6) % 7;
  const weeks = Math.ceil((lead + days) / 7);
  let busiest: { time: number; count: number } | null = null;
  const cells: YearCell[] = Array.from({ length: weeks * 7 }, (_, k) => {
    const i = k - lead;
    if (i < 0 || i >= days) return null;
    const time = new Date(year, 0, 1 + i, 12).getTime();
    const count = byDay.get(i)?.size ?? 0;
    if (count && (!busiest || count > busiest.count)) busiest = { time, count };
    return { time, count, future: new Date(year, 0, 1 + i).getTime() > now };
  });
  const months = Array.from({ length: 12 }, (_, m) => ({
    column: Math.floor((lead + index(new Date(year, m, 1, 12).getTime())) / 7),
    label: english ? new Date(year, m, 1).toLocaleString('en-US', { month: 'short' }) : `${m + 1}月`,
  }));
  return {
    cells,
    weeks,
    months,
    total: solved.size,
    activeDays: byDay.size,
    best: longestStreak(times),
    busiest: busiest as { time: number; count: number } | null,
  };
}
