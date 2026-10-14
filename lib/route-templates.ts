// Code templates for the 35 Line 500 stops: three key points, three pitfalls and the same
// pattern in four languages. The JSON is ~150 KB, so client components should load this
// module lazily (`await import('@/lib/route-templates')`) rather than import it eagerly.
// tests/route-templates.test.ts compiles and runs every template.
import data from './content/route-templates.json';

export type Bilingual = { zh: string; en: string };
export type TemplateLang = 'python' | 'cpp' | 'java' | 'go';
export type RouteTemplate = {
  slug: string;
  pattern: Bilingual;
  complexity: Bilingual;
  points: Bilingual[];
  pitfalls: Bilingual[];
  code: Record<TemplateLang, string>;
};

/** Display order and labels. */
export const TEMPLATE_LANGS: [TemplateLang, string][] = [
  ['python', 'Python'],
  ['cpp', 'C++'],
  ['java', 'Java'],
  ['go', 'Go'],
];

/** In Line 500 order (lib/route-stops.ts ROUTE_SECTIONS). */
export const routeTemplates = data as RouteTemplate[];
const bySlug = new Map(routeTemplates.map((t) => [t.slug, t]));

export function templateFor(slug: string): RouteTemplate | undefined {
  return bySlug.get(slug);
}

/** Where a line's trailing comment starts (outside string and char literals), or -1. */
export function commentStart(line: string, lang: TemplateLang): number {
  const marker = lang === 'python' ? '#' : '//';
  let quote = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'" || c === '`') quote = c;
    else if (line.startsWith(marker, i)) return i;
  }
  return -1;
}

/** Public cheat-sheet page for a stop. */
export const topicPath = (slug: string) => `/topics/${slug}`;
/** The stop on the Line 500 problem bank. */
export const line500Path = (slug: string) =>
  `/?view=problems&section=${encodeURIComponent(slug)}`;
