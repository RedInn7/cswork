// Server-side view of the 35 Line 500 stops for the public /topics pages.
import { curatedEntries, curatedSections } from '@/lib/ling-curated';
import { ROUTE_SECTIONS, STOP_NAMES, type RouteGroup } from '@/lib/route-stops';
import { routeTemplates, type RouteTemplate } from '@/lib/route-templates';
import { median } from '@/lib/lc-rating';
import { lcRatingOf } from '@/lib/server/lc-ratings';

export type TopicStop = RouteTemplate & {
  index: number;
  /** Two-digit stop number, as on the Line 500 map. */
  no: string;
  title: string;
  titleEn: string;
  short: [string, string];
  group: RouteGroup;
  problems: number;
  /** Contest ratings (zerotrac) of the stop's rated problems; null when none is rated. */
  ratings: { min: number; median: number; max: number; count: number } | null;
};

const sections = new Map(curatedSections.map((s) => [s.slug, s]));
const groups = new Map(
  ROUTE_SECTIONS.flatMap(({ zh, en, slugs }) => slugs.map((slug) => [slug, { zh, en }] as const)),
);
const problems = new Map<string, number>();
const rated = new Map<string, number[]>();
for (const entry of curatedEntries) {
  problems.set(entry.sectionSlug, (problems.get(entry.sectionSlug) ?? 0) + 1);
  const rating = lcRatingOf(entry.number)?.rating;
  if (rating) rated.set(entry.sectionSlug, [...(rated.get(entry.sectionSlug) ?? []), rating]);
}
const ratingsOf = (slug: string) => {
  const list = rated.get(slug);
  return list?.length
    ? { min: Math.min(...list), median: median(list)!, max: Math.max(...list), count: list.length }
    : null;
};

export const TOPIC_STOPS: TopicStop[] = routeTemplates.map((t, index) => ({
  ...t,
  index,
  no: String(index + 1).padStart(2, '0'),
  title: sections.get(t.slug)?.title ?? STOP_NAMES[t.slug][0],
  titleEn: sections.get(t.slug)?.titleEn ?? STOP_NAMES[t.slug][1],
  short: STOP_NAMES[t.slug],
  group: groups.get(t.slug)!,
  problems: problems.get(t.slug) ?? 0,
  ratings: ratingsOf(t.slug),
}));
const bySlug = new Map(TOPIC_STOPS.map((stop) => [stop.slug, stop]));
export const topicStop = (slug: string) => bySlug.get(slug);

export const TOPIC_GROUPS = ROUTE_SECTIONS.map(({ zh, en, slugs }) => ({
  zh,
  en,
  stops: slugs.map((slug) => bySlug.get(slug)!),
}));
