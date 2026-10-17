import { sitemapIndexXml, sitemapPageCount, xmlResponse } from '@/lib/seo';
import { publicLibraryCount } from '@/lib/server/public-library';
import { sitemapStatics } from '@/lib/server/sitemap';

export function GET() {
  const statics = sitemapStatics().length;
  return xmlResponse(
    sitemapIndexXml(sitemapPageCount(publicLibraryCount(), statics), ['oa', 'company', 'facets']),
  );
}
