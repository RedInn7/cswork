import {
  SITEMAP_STATIC_ENTRIES,
  sitemapChunks,
  sitemapLibraryRange,
  sitemapPageCount,
  sitemapXml,
  xmlResponse,
} from '@/lib/seo';
import {
  publicLibraryCount,
  publicLibraryEntries,
  publicLibraryPath,
} from '@/lib/server/public-library';

export async function GET(
  _request: Request,
  context: { params: Promise<{ page: string }> },
) {
  const { page: rawPage } = await context.params;
  if (!/^[1-9]\d{0,6}$/.test(rawPage))
    return new Response('Not found', { status: 404 });
  const page = Number(rawPage);
  if (page > sitemapPageCount(publicLibraryCount()))
    return new Response('Not found', { status: 404 });
  const { offset, limit } = sitemapLibraryRange(page);
  const entries = publicLibraryEntries(offset, limit).map((entry) => ({
    path: publicLibraryPath(entry.type, entry.slug),
    updatedAt: entry.updatedAt,
  }));
  const chunks = sitemapChunks([
    ...(page === 1 ? SITEMAP_STATIC_ENTRIES : []),
    ...entries,
  ]);
  // Public slugs are ASCII and limited to 300 characters. A 45,000-item batch
  // therefore fits below both sitemap limits; fail loudly if that contract changes.
  if (chunks.length !== 1)
    throw new Error('Public sitemap batch exceeds its size limit');
  return xmlResponse(sitemapXml(chunks[0]));
}
