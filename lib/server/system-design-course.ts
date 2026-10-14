import course from '@/lib/content/system-design-course.json';

export type SdQuestion = {
  qZh: string;
  qEn: string;
  choices: { zh: string; en: string }[];
  /** Index into `choices`. */
  answer: number;
  whyZh: string;
  whyEn: string;
};
export type SdChapter = {
  slug: string;
  titleZh: string;
  titleEn: string;
  /** Markdown, rendered by app/library/markdown.tsx. */
  bodyZh: string;
  bodyEn: string;
  quiz: SdQuestion[];
};

/** The system design course (lib/content/system-design-course.json), in reading order. */
export const sdChapters = (course as { chapters: SdChapter[] }).chapters;
export const sdChapter = (slug: string) => sdChapters.find((chapter) => chapter.slug === slug);
export const sdPath = (slug?: string) => (slug ? `/system-design/${slug}` : '/system-design');
/** Sitemap entries: the course index and every chapter. */
export const systemDesignPaths = () => [
  { path: sdPath() },
  ...sdChapters.map((chapter) => ({ path: sdPath(chapter.slug) })),
];

/** The chapter's first paragraph as plain text, cut to `max` characters: index cards and meta descriptions. */
export function sdSummary(body: string, max = 150) {
  const first =
    body
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .find((block) => block && !/^(#|>|[-*|]|\d+\.)/.test(block)) ?? '';
  const text = first
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ');
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
