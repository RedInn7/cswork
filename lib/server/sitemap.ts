import { SITEMAP_STATIC_ENTRIES, type SitemapEntry } from '@/lib/seo';
import { h1bPaths } from './h1b';
import { mockOaPaths } from './mock-oa-presets';
import { systemDesignPaths } from './system-design-course';

/**
 * Sitemap page 1's fixed pages: lib/seo.ts's list plus the pages built from server-side content,
 * which stays out of lib/seo.ts because client components import it. The index (app/sitemap.xml)
 * and the pages (app/sitemap/[page]) both count this one list, so their library offsets agree.
 * Downloads (/projects/<slug>/accept) and feeds (/feeds/*) are not pages and stay out.
 */
export const sitemapStatics = (): SitemapEntry[] => [
  ...SITEMAP_STATIC_ENTRIES,
  ...mockOaPaths(),
  ...systemDesignPaths(),
  ...h1bPaths(),
];
