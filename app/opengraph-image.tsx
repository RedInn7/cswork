import { ogImage, OG_SIZE } from '@/lib/server/og-card';

// The site card: every page without its own (lib/seo.ts seoMetadata `image`) shares it.
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'CSWork';

export default function Image() {
  return ogImage();
}
