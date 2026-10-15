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
import { h1bPaths } from '@/lib/server/h1b';

export function GET() {
  const statics =
    SITEMAP_STATIC_ENTRIES.length + mockOaPaths().length + systemDesignPaths().length + learnPaths().length + h1bPaths().length;
  return xmlResponse(
    sitemapIndexXml(sitemapPageCount(publicLibraryCount(), statics), ['oa', 'company', 'facets']),
  );
}
