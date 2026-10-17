// Code templates for the 35 Line 500 stops: three key points, three pitfalls and the same
// pattern in four languages. The JSON is ~150 KB, so client components should load this
// module lazily (`await import('@/lib/route-templates')`) rather than import it eagerly.
// Each stop's drivers (the code that calls a template, and its expected stdout) are in
// lib/route-template-drivers.ts; tests/route-templates.test.ts compiles and runs every template with them.
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

// Client-safe (no JSON): lib/template-drills.ts owns it so the drills don't pull this file in.
export { commentStart } from './template-drills';

/** Public cheat-sheet page for a stop. */
export const topicPath = (slug: string) => `/topics/${slug}`;
/** The stop on the Line 500 problem bank. */
export const line500Path = (slug: string) =>
  `/?view=problems&section=${encodeURIComponent(slug)}`;
