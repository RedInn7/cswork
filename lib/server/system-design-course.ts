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
/** The index's parts: each runs from its first chapter up to the next part's. */
export const sdParts = [
  { from: 'framework', zh: '系统设计：框架与案例', en: 'System design: framework and cases' },
  { from: 'ood-interview-approach', zh: '面向对象设计（LLD）', en: 'Object-oriented design (LLD)' },
  { from: 'concurrency-primitives', zh: '并发编程', en: 'Concurrency' },
  { from: 'ml-design-framework', zh: 'ML 系统设计', en: 'ML system design' },
].map((part, i, parts) => {
  const at = (slug: string) => sdChapters.findIndex((chapter) => chapter.slug === slug);
  const next = parts[i + 1];
  return { ...part, chapters: sdChapters.slice(at(part.from), next ? at(next.from) : undefined) };
});
// Design exercises: the chapter page asks for the learner's own design before its walkthrough.
export const sdCases = new Set([
  'url-shortener',
  'rate-limiter',
  'news-feed',
  'chat-messaging',
  'ride-sharing',
  'notification-system',
  'video-streaming',
  'web-crawler',
  'distributed-kv-store',
  'payment-ledger',
  'search-autocomplete',
  'ticket-booking',
  'recsys-ranking',
  'search-ranking',
  'ads-ctr',
  'fraud-detection',
]);
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
