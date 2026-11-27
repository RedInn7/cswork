import type { Metadata } from 'next';
import { classicLists } from './classic-lists';
import { ROUTE_SECTIONS } from './route-stops';
import { GUIDE_CHAPTERS, guidePath } from './career-guide';
import { AI_TASK_SLUGS, ICA_TASK_SLUGS, TAKE_HOME_SLUGS } from './ai-coding';
import { htmlLang, languagePath, LANGUAGES, type Language } from './language';

// Public URLs must not follow request hosts or private deployment configuration.
export const SITE_URL = 'https://cswork.org';
export const SITE_NAME = 'CSWork';
/**
 * The landing page in each language: tab title, search description, and the heading and
 * introduction readers see (components/workspace-intro.tsx). Traditional Chinese is the `zh`
 * entry converted. Each one leads with what people search for and what they get: LeetCode problems and OA questions, free.
 */
export const SEO_HOME = {
  zh: {
    title: 'CSWork · 免费刷 LeetCode 算法题和 OA 真题',
    description:
      '免费刷 LeetCode 算法题和各公司 OA 真题，在线判题支持 Python、Java、C++ 和 Go。还有北美公司面经和系统设计，帮你准备实习和全职软件工程师面试。',
    heading: '免费刷 LeetCode 题和 OA 真题',
    intro: '算法题按专题练，OA 真题按公司找，写完直接在线判题，全部免费。面经、系统设计和后端课程也都在这里。',
  },
  en: {
    title: 'CSWork · Free LeetCode Problems & Real OA Questions',
    description:
      'Practice LeetCode problems and real company online assessment (OA) questions for free, judged online in Python, Java, C++ and Go. Plus interview experiences and system design notes for software engineering internships and jobs.',
    heading: 'Free LeetCode problems and real OA questions',
    intro:
      'Work through LeetCode problems by topic and online assessment (OA) questions by company, and get your code judged as you go. All of it is free. Interview experiences, system design and backend courses are here too.',
  },
  ja: {
    title: 'CSWork · 無料で解ける LeetCode 問題と OA（コーディングテスト）過去問',
    description:
      'LeetCode の問題と企業別のオンラインアセスメント（OA）過去問を、オンラインジャッジで無料で解いて練習できます。Python・Java・C++・Go に対応。米国テック企業のソフトウェアエンジニア面接対策に。',
    heading: 'LeetCode 問題と OA 過去問を無料で練習',
    intro:
      'テーマ別の LeetCode 問題と、企業ごとのコーディングテスト（OA）過去問をその場で採点。すべて無料です。面接体験記やシステム設計の資料も読めます。問題文と画面は英語です。',
  },
  ko: {
    title: 'CSWork · 무료 LeetCode 문제와 코딩테스트(OA) 기출',
    description:
      'LeetCode 문제와 기업별 온라인 코딩테스트(OA) 기출 문제를 온라인 저지에서 무료로 풀어 보세요. Python, Java, C++, Go를 지원합니다. 미국 테크 기업 소프트웨어 엔지니어 면접 준비에 필요한 자료를 한곳에 모았습니다.',
    heading: 'LeetCode 문제와 OA 기출을 무료로 풀어 보세요',
    intro:
      '주제별 LeetCode 문제와 기업별 코딩테스트(OA) 기출을 풀고 바로 채점받을 수 있습니다. 모두 무료입니다. 면접 후기와 시스템 설계 자료도 함께 볼 수 있습니다. 문제와 화면은 영어로 제공됩니다.',
  },
  vi: {
    title: 'CSWork · Luyện LeetCode và đề OA miễn phí',
    description:
      'Luyện miễn phí các bài LeetCode và đề online assessment (OA) thật theo từng công ty, chấm bài trực tuyến bằng Python, Java, C++ và Go. Tài liệu chuẩn bị phỏng vấn kỹ sư phần mềm tại các công ty công nghệ Mỹ.',
    heading: 'Luyện bài LeetCode và đề OA thật, miễn phí',
    intro:
      'Làm bài LeetCode theo chủ đề và đề OA thật của từng công ty, nộp bài là có kết quả chấm ngay. Tất cả đều miễn phí. Có cả kinh nghiệm phỏng vấn và tài liệu thiết kế hệ thống. Đề bài và giao diện bằng tiếng Anh.',
  },
};
/** The landing copy for a site language. */
export const homeCopy = (language: Language) => SEO_HOME[language === 'zh-Hant' ? 'zh' : language];

/** The company OA index (/oa) for the languages without an interface of their own. */
export const OA_INDEX: Partial<
  Record<Language, { title: string; heading: string; lead: (total: number, companies: number, ready: number) => string }>
> = {
  ja: {
    title: '企業別 OA（コーディングテスト）過去問',
    heading: '企業別の OA 過去問を解く',
    lead: (total, companies, ready) =>
      `${companies} 社のオンラインアセスメント（OA）過去問 ${total} 問を収録。そのうち ${ready} 問は Python・Java・C++・Go でオンライン採点できます。`,
  },
  ko: {
    title: '기업별 OA(코딩테스트) 기출 문제',
    heading: '기업별 OA 기출 문제 풀기',
    lead: (total, companies, ready) =>
      `${companies}개 기업의 온라인 코딩테스트(OA) 기출 ${total}문제. 그중 ${ready}문제는 Python, Java, C++, Go로 온라인 채점이 됩니다.`,
  },
  vi: {
    title: 'Đề OA (online assessment) theo công ty',
    heading: 'Luyện đề OA thật theo từng công ty',
    lead: (total, companies, ready) =>
      `${total} đề online assessment (OA) của ${companies} công ty. ${ready} đề chấm trực tuyến được bằng Python, Java, C++ và Go.`,
  },
};

/** Browser tab title for a workspace view; no name means the landing page. */
export function workspaceTitle(language: Language, name?: string) {
  return name ? `${name} · ${SITE_NAME}` : homeCopy(language).title;
}

function publicUrl(path: string): string {
  const url = new URL(path, SITE_URL);
  if (url.origin !== SITE_URL)
    throw new Error('Public SEO URLs must use the production origin');
  url.hash = '';
  return url.toString();
}

/** A problem's workspace on the public origin, for the share button; never the request host. */
export const problemShareUrl = (problemId: string) =>
  publicUrl(`/?${new URLSearchParams({ view: 'problem', problem: problemId })}`);

/** Languages every public page is written in; Japanese, Korean and Vietnamese only where `localized`. */
const INTERFACE_LANGUAGES: Language[] = ['zh', 'zh-Hant', 'en'];
const OG_LOCALE: Record<Language, string> = {
  zh: 'zh_CN',
  'zh-Hant': 'zh_TW',
  en: 'en_US',
  ja: 'ja_JP',
  ko: 'ko_KR',
  vi: 'vi_VN',
};

/**
 * `image`: the page's own share card (an opengraph-image route path); without one a page gets
 * the site card through app/opengraph-image.tsx.
 * `language`: the language of this URL (pages call lib/server/seo.ts pageMetadata, which reads it
 * from the request). Each language is its own canonical page, linked to the others by hreflang.
 * `localized`: the page has Japanese, Korean and Vietnamese copy (true), or copy in the listed
 * ones only; elsewhere those URLs show the English interface and point to the English page as
 * canonical.
 */
export function seoMetadata({
  title,
  description,
  path,
  image,
  language = 'zh',
  localized = false,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  language?: Language;
  localized?: boolean | readonly Language[];
}): Metadata {
  const offered =
    localized === true ? LANGUAGES.map((option) => option.value) : [...INTERFACE_LANGUAGES, ...(localized || [])];
  const url = publicUrl(languagePath(offered.includes(language) ? language : 'en', path));
  const images = image ? [{ url: publicUrl(image), width: 1200, height: 630, alt: title }] : undefined;
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(
          offered.map((option) => [
            option === 'zh' ? 'zh-Hans' : htmlLang(option),
            publicUrl(languagePath(option, path)),
          ]),
        ),
        // Readers of any other language get English.
        'x-default': publicUrl(languagePath('en', path)),
      },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: 'website',
      locale: OG_LOCALE[language],
      ...(images && { images }),
    },
    twitter: images ? { card: 'summary_large_image', title, description, images } : { card: 'summary', title, description },
  };
}

/** OA page titles: the index, a company (`company`), or one of its problems (`company`, `title`). */
export function oaPageTitle(
  locale: keyof typeof SEO_HOME,
  company?: string,
  title?: string,
) {
  const zh = locale === 'zh';
  const name = !company
    ? zh
      ? '公司 OA 真题题库'
      : 'Company OA Questions'
    : title
      ? zh
        ? `${company} OA 真题：${title}`
        : `${company} OA: ${title}`
      : zh
        ? `${company} OA 真题与在线判题`
        : `${company} OA Questions & Practice`;
  return `${name} | ${SITE_NAME}`;
}

/** Company page title (/company/<slug>). */
export const companyPageTitle = (locale: keyof typeof SEO_HOME, company: string) =>
  `${locale === 'zh' ? `${company} 面试题、OA 真题与面经` : `${company} Interview Questions, OA & Experiences`} | ${SITE_NAME}`;

/** schema.org BreadcrumbList for an inline ld+json script (`<` escaped). */
export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((step, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: step.name,
      item: publicUrl(step.path),
    })),
  }).replace(/</g, '\\u003c');
}

/** schema.org ItemList of a landing page's entries, for an inline ld+json script (`<` escaped). */
export function itemListJsonLd(name: string, items: { name: string; path: string }[]) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: publicUrl(item.path),
    })),
  }).replace(/</g, '\\u003c');
}

/** Role / category landing pages, alone or for one company (lib/server/seo-facets.ts). */
export function facetPageTitle(
  locale: keyof typeof SEO_HOME,
  kind: 'role' | 'cat',
  name: string,
  company?: string,
) {
  const zh = locale === 'zh';
  const who = company ? `${company} ` : '';
  const title =
    kind === 'role'
      ? zh
        ? `${who}${name} 面试题与面经`
        : `${who}${name} Interview Questions & Experiences`
      : zh
        ? `${who}${name} 面试题`
        : `${who}${name} Interview Questions`;
  return `${title} | ${SITE_NAME}`;
}

export type SitemapEntry = { path: string; updatedAt?: string | null };
const XML_START = '<?xml version="1.0" encoding="UTF-8"?>';
const XML_NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9';
// Leave room below both protocol limits (50,000 URLs and 50 MiB per file).
export const SITEMAP_URL_LIMIT = 45_000;
export const SITEMAP_STATIC_ENTRIES: SitemapEntry[] = [
  { path: '/' },
  { path: '/library' },
  { path: '/acm-io' },
  { path: '/judge-environment' },
  { path: '/interview-platforms' },
  { path: '/flowchart' },
  { path: '/placement' },
  { path: '/daily' },
  { path: '/mcp' },
  { path: '/privacy' },
  { path: '/lists' },
  { path: '/company/top' },
  ...classicLists.map((list) => ({ path: `/lists/${list.slug}` })),
  { path: '/lists/community' },
  { path: '/topics' },
  { path: '/topics/glossary' },
  { path: '/topics/print' },
  { path: '/roadmap' },
  { path: '/almanac' },
  { path: '/core-skills' },
  ...ROUTE_SECTIONS.flatMap((s) => s.slugs.map((slug) => ({ path: `/topics/${slug}` }))),
  { path: guidePath() },
  ...GUIDE_CHAPTERS.map((chapter) => ({ path: guidePath(chapter.slug) })),
  { path: '/career/resume' },
  { path: '/career/resume/builder' },
  { path: '/career/jd' },
  { path: '/career/jobs' },
  // noindex until the first sync has recorded a season (app/career/jobs/calendar/page.tsx).
  { path: '/career/jobs/calendar' },
  { path: '/career/visa-timeline' },
  { path: '/career/offers' },
  { path: '/career/templates' },
  { path: '/career/negotiation' },
  { path: '/ai-assisted' },
  ...AI_TASK_SLUGS.map((slug) => ({ path: `/ai-assisted/${slug}` })),
  { path: '/take-home' },
  ...TAKE_HOME_SLUGS.map((slug) => ({ path: `/take-home/${slug}` })),
  { path: '/oa/mcq' },
  { path: '/oa/aptitude' },
  { path: '/oa/sims' },
  { path: '/oa/ica' },
  ...ICA_TASK_SLUGS.map((slug) => ({ path: `/oa/ica/${slug}` })),
];
/** `statics`: entries written before the library on page 1 (static pages plus the mock OA pages). */
export function sitemapPageCount(
  libraryCount: number,
  statics = SITEMAP_STATIC_ENTRIES.length,
): number {
  return Math.ceil((libraryCount + statics) / SITEMAP_URL_LIMIT);
}
export function sitemapLibraryRange(
  page: number,
  statics = SITEMAP_STATIC_ENTRIES.length,
): {
  offset: number;
  limit: number;
} {
  return {
    offset: Math.max(0, (page - 1) * SITEMAP_URL_LIMIT - statics),
    limit: SITEMAP_URL_LIMIT - (page === 1 ? statics : 0),
  };
}
const SITEMAP_BYTE_LIMIT = 45 * 1024 * 1024;
const escapeXml = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (char) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
      })[char]!,
  );

function sitemapNode(entry: SitemapEntry, language: Language): string {
  const url = escapeXml(publicUrl(languagePath(language, entry.path)));
  const date = entry.updatedAt ? new Date(entry.updatedAt) : null;
  const lastmod =
    date && Number.isFinite(date.getTime())
      ? `<lastmod>${date.toISOString()}</lastmod>`
      : '';
  return `<url><loc>${url}</loc>${lastmod}</url>`;
}

/** No truncation: every public URL appears in exactly one size-bounded shard. */
export function sitemapChunks(entries: SitemapEntry[], language: Language = 'zh'): string[][] {
  const chunks: string[][] = [[]];
  let bytes = 256;
  for (const entry of entries) {
    const node = sitemapNode(entry, language);
    const size = new TextEncoder().encode(node).byteLength;
    if (size + 256 > SITEMAP_BYTE_LIMIT)
      throw new Error('Sitemap URL exceeds the file size limit');
    let chunk = chunks[chunks.length - 1];
    if (
      chunk.length >= SITEMAP_URL_LIMIT ||
      bytes + size > SITEMAP_BYTE_LIMIT
    ) {
      chunk = [];
      chunks.push(chunk);
      bytes = 256;
    }
    chunk.push(node);
    bytes += size;
  }
  return chunks;
}

export function sitemapXml(nodes: string[]): string {
  return `${XML_START}<urlset xmlns="${XML_NAMESPACE}">${nodes.join('')}</urlset>`;
}

/** Pages with Japanese, Korean and Vietnamese copy (`localized` in seoMetadata); their whole sitemap. */
export const LOCALIZED_ENTRIES: SitemapEntry[] = [{ path: '/' }, { path: '/oa' }];

/**
 * Numbered library shards, then named ones (`/sitemap/oa`), once per language with every page
 * (`/en/sitemap/1`); the remaining languages list their few pages in one file each.
 */
export function sitemapIndexXml(count: number, named: string[] = []): string {
  const pages = [...Array.from({ length: count }, (_, index) => String(index + 1)), ...named];
  const nodes = LANGUAGES.flatMap(({ value }) =>
    (INTERFACE_LANGUAGES.includes(value) ? pages : ['1']).map(
      (page) => `<sitemap><loc>${SITE_URL}${languagePath(value, `/sitemap/${page}`)}</loc></sitemap>`,
    ),
  );
  return `${XML_START}<sitemapindex xmlns="${XML_NAMESPACE}">${nodes.join('')}</sitemapindex>`;
}
/** Whether `language` has its own URL for every public page. */
export const hasEveryPage = (language: Language) => INTERFACE_LANGUAGES.includes(language);

export function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
