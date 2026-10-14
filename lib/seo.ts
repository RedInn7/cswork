import type { Metadata } from 'next';

// Public URLs must not follow request hosts or private deployment configuration.
export const SITE_URL = 'https://cswork.org';
export const SITE_NAME = 'CSWork';
export const SEO_HOME = {
  zh: {
    title: 'CSWork · 北美程序员求职、OA 与面试准备',
    description:
      '在 CSWork 练习编程题和 OA，阅读公司面经、算法讲解与系统设计资料，学习 Go 后端项目，为实习和软件工程师求职做好准备。',
  },
  en: {
    title: 'CSWork · Coding Practice, OA & SWE Interview Prep',
    description:
      'Prepare for software engineering internships and jobs with coding practice, online assessments, company interview experiences, algorithms and Go backend projects.',
  },
};

/** Browser tab title for a workspace view; no name means the landing page. */
export function workspaceTitle(locale: keyof typeof SEO_HOME, name?: string) {
  return name ? `${name} · ${SITE_NAME}` : SEO_HOME[locale].title;
}

function publicUrl(path: string): string {
  const url = new URL(path, SITE_URL);
  if (url.origin !== SITE_URL)
    throw new Error('Public SEO URLs must use the production origin');
  url.hash = '';
  return url.toString();
}

export function seoMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const url = publicUrl(path);
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: 'website',
    },
    twitter: { card: 'summary', title, description },
  };
}

export type SitemapEntry = { path: string; updatedAt?: string | null };
const XML_START = '<?xml version="1.0" encoding="UTF-8"?>';
const XML_NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9';
// Leave room below both protocol limits (50,000 URLs and 50 MiB per file).
export const SITEMAP_URL_LIMIT = 45_000;
export const SITEMAP_STATIC_ENTRIES: SitemapEntry[] = [
  { path: '/' },
  { path: '/library' },
  { path: '/privacy' },
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

function sitemapNode(entry: SitemapEntry): string {
  const url = escapeXml(publicUrl(entry.path));
  const date = entry.updatedAt ? new Date(entry.updatedAt) : null;
  const lastmod =
    date && Number.isFinite(date.getTime())
      ? `<lastmod>${date.toISOString()}</lastmod>`
      : '';
  return `<url><loc>${url}</loc>${lastmod}</url>`;
}

/** No truncation: every public URL appears in exactly one size-bounded shard. */
export function sitemapChunks(entries: SitemapEntry[]): string[][] {
  const chunks: string[][] = [[]];
  let bytes = 256;
  for (const entry of entries) {
    const node = sitemapNode(entry);
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

export function sitemapIndexXml(count: number): string {
  const nodes = Array.from(
    { length: count },
    (_, index) =>
      `<sitemap><loc>${SITE_URL}/sitemap/${index + 1}</loc></sitemap>`,
  );
  return `${XML_START}<sitemapindex xmlns="${XML_NAMESPACE}">${nodes.join('')}</sitemapindex>`;
}

export function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
