import { beijingDate, dailyPick, type DailyProblem } from '@/lib/daily-problem';
import { curatedByNumber } from '@/lib/ling-curated';
import type { ProblemSummary } from '@/lib/problems';
import { mockCatalogue } from './mock-oa';
import { shownMockPresets } from './mock-oa-presets';
import { listProblemSummaries } from './oj-problems';

type Activity = { problem_id: string; created_at: number };
type Hot = readonly { name: string; aliases: readonly string[] }[];

/**
 * Pools from the catalogue anyone may judge: Line 500 problems, and coding OAs of the
 * mock OA preset companies (hidden companies are already out of both). Picks are
 * memoised per date, so the activity check costs one draw per distinct day.
 */
export function dailySource(summaries: readonly ProblemSummary[], hot: Hot) {
  const { oa, lc } = mockCatalogue(summaries);
  const presetName = new Map(hot.flatMap((p) => p.aliases.map((a) => [a, p.name] as const)));
  const line = [...lc.values()].flatMap((item) => (item.topics ? [item.id] : []));
  const oaPool = [...oa].flatMap(([company, items]) =>
    presetName.has(company) ? items.map((item) => item.id) : [],
  );
  const byId = new Map(summaries.map((s) => [s.id, s]));
  const picks = new Map<string, string | null>();
  const pick = (date: string) => {
    if (!picks.has(date)) picks.set(date, dailyPick(date, line, oaPool));
    return picks.get(date)!;
  };
  return {
    pick,
    /** `now`'s problem and which of `activity` solved its own day's problem. */
    daily(activity: readonly Activity[], now: number): DailyProblem | null {
      const date = beijingDate(now);
      const id = pick(date);
      const summary = id ? byId.get(id) : undefined;
      if (!id || !summary) return null;
      const number = /^lc-(\d+)$/.exec(id)?.[1];
      const company = /^oa-(.+)-\d+$/.exec(id)?.[1];
      const stop = number ? curatedByNumber.get(Number(number))?.sectionSlug : undefined;
      return {
        date,
        id,
        kind: number ? 'lc' : 'oa',
        title: summary.title,
        ...(summary.titleEn ? { titleEn: summary.titleEn } : {}),
        difficulty: summary.difficulty,
        ...(stop ? { stop } : {}),
        ...(company ? { company: { slug: company, name: presetName.get(company) ?? company } } : {}),
        done: activity.flatMap((a) =>
          pick(beijingDate(a.created_at)) === a.problem_id ? [a.created_at] : [],
        ),
      };
    },
  };
}

// ponytail: one snapshot for 5 minutes, like the mock OA catalogue; publishes show up after that.
let cached: { at: number; value: Promise<ReturnType<typeof dailySource>> } | null = null;

/** Today's problem (Beijing date) for everyone, with this viewer's completions from `activity`. */
export async function dailyProblem(activity: readonly Activity[] = [], now = Date.now()) {
  if (!cached || now - cached.at > 300000) {
    const value = listProblemSummaries(null).then((s) => dailySource(s, shownMockPresets()));
    cached = { at: now, value };
    value.catch(() => {
      if (cached?.value === value) cached = null;
    });
  }
  return (await cached.value).daily(activity, now);
}
