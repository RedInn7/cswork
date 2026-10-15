// Interview reports by age (company pages, the bank's frequency order, a problem's companies). Client-safe.
/**
 * Reports by age, in disjoint buckets: up to 90 days, 6 months, a year, two years, older. A source
 * the library does not date (or no longer lists) counts as older.
 */
export type ReportWindows = { m3: number; m6: number; y1: number; y2: number; older: number };
/** ?window= values, narrowest first; `all` (or none) is every report. */
export const REPORT_WINDOWS = ['3m', '6m', '1y', '2y'] as const;
export type ReportWindow = (typeof REPORT_WINDOWS)[number] | 'all';
/** Window names, [zh, en]. */
export const WINDOW_NAMES: Record<ReportWindow, [string, string]> = {
  '3m': ['近 3 个月', 'Last 3 months'],
  '6m': ['近 6 个月', 'Last 6 months'],
  '1y': ['近 1 年', 'Last year'],
  '2y': ['近 2 年', 'Last 2 years'],
  all: ['全部', 'All time'],
};
const DAY = 86400000;
const BUCKETS = [['m3', 90], ['m6', 182], ['y1', 365], ['y2', 730]] as const;
export const reportWindow = (value: unknown): ReportWindow =>
  (REPORT_WINDOWS as readonly unknown[]).includes(value) ? (value as ReportWindow) : 'all';

/** `sources`' reports by age at `now`; `dated` maps a content slug to its date (YYYY-MM-DD). */
export function windowCounts(
  sources: readonly string[],
  dated: ReadonlyMap<string, { date: string | null }>,
  now: number,
): ReportWindows {
  const out: ReportWindows = { m3: 0, m6: 0, y1: 0, y2: 0, older: 0 };
  for (const slug of sources) {
    // Whole days since the report's date (UTC), so a report 90 days old is in for all of that day.
    const days = Math.floor((now - Date.parse(dated.get(slug)?.date ?? '')) / DAY);
    out[BUCKETS.find(([, max]) => days <= max)?.[0] ?? 'older']++;
  }
  return out;
}
/** Reports inside a window: its bucket and every narrower one. */
export function inWindow(w: ReportWindows, period: ReportWindow) {
  if (period === 'all') return w.m3 + w.m6 + w.y1 + w.y2 + w.older;
  return BUCKETS.slice(0, REPORT_WINDOWS.indexOf(period) + 1).reduce((n, [key]) => n + w[key], 0);
}
