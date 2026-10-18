// Code templates for the 35 Line 500 stops: three key points, three pitfalls and the same
// pattern in four languages. The JSON is ~150 KB, so client components should load this
// module lazily (`await import('@/lib/route-templates')`) rather than import it eagerly.
// Each stop's drivers (the code that calls a template, and its expected stdout) are in
// lib/route-template-drivers.ts; tests/route-templates.test.ts compiles and runs every template with them.
// Each stop's 2–6 variants (another code shape for the same stop, with its own driver) are in
// route-template-variants.json: server-side only, the topic page passes what a drill needs.
import data from './content/route-templates.json';
import variantData from './content/route-template-variants.json';

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

/** Another shape of a stop's template; `driver` is the same kind as DRIVERS' (route-template-drivers.ts). */
export type TemplateVariant = {
  /** Kebab case, unique within the stop, never 'main'. */
  id: string;
  pattern: Bilingual;
  /** When to reach for it instead of the main template. */
  when: Bilingual;
  complexity: Bilingual;
  code: Record<TemplateLang, string>;
  driver: Record<TemplateLang, string> & { expected: string };
};
/** `variant` is 'main' or a variant id; each line of `key` appears verbatim in that code. */
export type MatrixCell = { variant: string; key: Record<TemplateLang, string> } | { note: Bilingual };
export type VariantMatrix = { rows: Bilingual[]; cols: Bilingual[]; cells: MatrixCell[][] };
type StopVariants = { variants: TemplateVariant[]; matrix?: VariantMatrix };

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

const variants = variantData as Record<string, StopVariants>;
export const variantsFor = (slug: string): TemplateVariant[] => variants[slug]?.variants ?? [];
export const matrixFor = (slug: string): VariantMatrix | undefined => variants[slug]?.matrix;

// Client-safe (no JSON): lib/template-drills.ts owns it so the drills don't pull this file in.
export { commentStart } from './template-drills';

/** Public cheat-sheet page for a stop. */
export const topicPath = (slug: string) => `/topics/${slug}`;
/** The stop on the Line 500 problem bank. */
export const line500Path = (slug: string) =>
  `/?view=problems&section=${encodeURIComponent(slug)}`;
