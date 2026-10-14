// Server-side view of the 35 Line 500 stops for the public /topics pages.
import { curatedEntries, curatedSections } from '@/lib/ling-curated';
import { ROUTE_SECTIONS, STOP_NAMES, type RouteGroup } from '@/lib/route-stops';
import { routeTemplates, type RouteTemplate } from '@/lib/route-templates';

export type TopicStop = RouteTemplate & {
  index: number;
  /** Two-digit stop number, as on the Line 500 map. */
  no: string;
  title: string;
  titleEn: string;
  short: [string, string];
  group: RouteGroup;
  problems: number;
};

const sections = new Map(curatedSections.map((s) => [s.slug, s]));
const groups = new Map(
  ROUTE_SECTIONS.flatMap(({ zh, en, slugs }) => slugs.map((slug) => [slug, { zh, en }] as const)),
);
const problems = new Map<string, number>();
for (const entry of curatedEntries)
  problems.set(entry.sectionSlug, (problems.get(entry.sectionSlug) ?? 0) + 1);

export const TOPIC_STOPS: TopicStop[] = routeTemplates.map((t, index) => ({
  ...t,
  index,
  no: String(index + 1).padStart(2, '0'),
  title: sections.get(t.slug)?.title ?? STOP_NAMES[t.slug][0],
  titleEn: sections.get(t.slug)?.titleEn ?? STOP_NAMES[t.slug][1],
  short: STOP_NAMES[t.slug],
  group: groups.get(t.slug)!,
  problems: problems.get(t.slug) ?? 0,
}));
const bySlug = new Map(TOPIC_STOPS.map((stop) => [stop.slug, stop]));
export const topicStop = (slug: string) => bySlug.get(slug);

export const TOPIC_GROUPS = ROUTE_SECTIONS.map(({ zh, en, slugs }) => ({
  zh,
  en,
  stops: slugs.map((slug) => bySlug.get(slug)!),
}));
