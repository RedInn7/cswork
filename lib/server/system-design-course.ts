import course from '@/lib/content/system-design-course.json';
import { playgroundLanguage } from '@/lib/playground-share';

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
/** The certificate's chapters and the progress bar's: all but the optional key-technology, pattern, LLD case and API reading. */
export const sdRequired = sdChapters.map((chapter) => chapter.slug).filter((slug) => !/^(tech|pattern|lld-case|api)-/.test(slug));
export const sdChapter = (slug: string) => sdChapters.find((chapter) => chapter.slug === slug);
/** The index's parts: each runs from its first chapter up to the next part's. */
export const sdParts = [
  { from: 'framework', zh: '系统设计：框架与案例', en: 'System design: framework and cases' },
  { from: 'ood-interview-approach', zh: '面向对象设计（LLD）', en: 'Object-oriented design (LLD)' },
  { from: 'concurrency-primitives', zh: '并发编程', en: 'Concurrency' },
  { from: 'ml-design-framework', zh: 'ML 系统设计', en: 'ML system design' },
  // Optional reading: not design exercises (sdCases) and not required for the certificate.
  { from: 'tech-kafka', zh: '关键技术（选读）', en: 'Key technologies (optional)' },
  { from: 'pattern-real-time-updates', zh: '通用设计模式（选读）', en: 'Patterns (optional)' },
  { from: 'lld-case-atm', zh: 'LLD 案例库（选读）', en: 'LLD case library (optional)' },
  { from: 'api-rest-vs-rpc-graphql', zh: 'API 设计（选读）', en: 'API design (optional)' },
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
/** The capacity estimation drill's own page (components/estimation-drill.tsx); no chapter takes this slug. */
export const SD_ESTIMATION = 'estimation';
/** Sitemap entries: the course index, every chapter and the estimation drill. */
export const systemDesignPaths = () => [
  { path: sdPath() },
  ...sdChapters.map((chapter) => ({ path: sdPath(chapter.slug) })),
  { path: sdPath(SD_ESTIMATION) },
];

/**
 * Reading time in whole minutes: Chinese at 400 characters a minute, English at 200 words,
 * and fenced code or diagrams at 15 non-blank lines a minute. A tab group (the same code in
 * several languages, lib/remark-code-tabs.ts) is read in one language: only its first block counts.
 */
export function readMinutes(markdown: string) {
  let lines = 0,
    end = -1,
    group: string[] = [];
  const prose = markdown.replace(/^```([^\n]*)\n([\s\S]*?)^```/gm, (block: string, tag: string, code: string, at: number) => {
    const lang = playgroundLanguage(tag.split(/\s/)[0]);
    const tab = lang !== null && group.length > 0 && !group.includes(lang) && !markdown.slice(end, at).trim();
    group = lang === null ? [] : tab ? [...group, lang] : [lang];
    end = at + block.length;
    if (!tab) lines += code.split('\n').filter((line) => line.trim()).length;
    return '';
  });
  const han = prose.match(/\p{Script=Han}/gu)?.length ?? 0;
  const words = prose.match(/[A-Za-z0-9]+(?:['’.-][A-Za-z0-9]+)*/g)?.length ?? 0;
  return Math.max(1, Math.round(han / 400 + words / 200 + lines / 15));
}
// The course JSON is fixed for the process, so each chapter is measured once, on first use.
const measured = new WeakMap<object, [zh: number, en: number]>();
/** A chapter's reading time in the reader's language (system design or beginner course chapters). */
export function chapterMinutes(chapter: { bodyZh: string; bodyEn: string }, zh: boolean) {
  let both = measured.get(chapter);
  if (!both) measured.set(chapter, (both = [readMinutes(chapter.bodyZh), readMinutes(chapter.bodyEn)]));
  return both[zh ? 0 : 1];
}
/** A course's (or a part's) reading time: the sum of its chapters'. */
export const totalMinutes = (chapters: { bodyZh: string; bodyEn: string }[], zh: boolean) =>
  chapters.reduce((n, chapter) => n + chapterMinutes(chapter, zh), 0);
/** "约 25 分钟" / "~25 min"; an hour or more reads "约 3 小时 10 分钟" / "~3 h 10 min". */
export function minutesLabel(minutes: number, zh: boolean) {
  const h = Math.floor(minutes / 60),
    m = minutes % 60;
  if (!h) return zh ? `约 ${m} 分钟` : `~${m} min`;
  return zh ? `约 ${h} 小时${m ? ` ${m} 分钟` : ''}` : `~${h} h${m ? ` ${m} min` : ''}`;
}

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
