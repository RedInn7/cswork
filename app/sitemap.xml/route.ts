import { sitemapIndexXml, sitemapPageCount, xmlResponse } from '@/lib/seo';
import { publicLibraryCount } from '@/lib/server/public-library';

export function GET() {
  return xmlResponse(
    sitemapIndexXml(sitemapPageCount(publicLibraryCount()), ['oa']),
  );
}
