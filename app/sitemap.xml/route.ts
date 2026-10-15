import {
  SITEMAP_STATIC_ENTRIES,
  sitemapIndexXml,
  sitemapPageCount,
  xmlResponse,
} from '@/lib/seo';
import { publicLibraryCount } from '@/lib/server/public-library';
import { mockOaPaths } from '@/lib/server/mock-oa-presets';
import { systemDesignPaths } from '@/lib/server/system-design-course';
import { learnPaths } from '@/lib/server/beginner-courses';

export function GET() {
  const statics =
    SITEMAP_STATIC_ENTRIES.length + mockOaPaths().length + systemDesignPaths().length + learnPaths().length;
  return xmlResponse(
    sitemapIndexXml(sitemapPageCount(publicLibraryCount(), statics), ['oa', 'company', 'facets']),
  );
}
