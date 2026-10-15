import { OTHER_COMPANY } from '@/lib/oa-company-brands';
import { oaCompanyOg, ogImage, OG_SIZE } from '@/lib/server/og-card';
import { oaReadyProblems } from '@/lib/server/oa-judge';
import { oaLibrary } from '@/lib/server/oa-library';
import { mockPresetFor } from '@/lib/server/mock-oa-presets';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'CSWork OA questions';

/** The company page's counts and exam platform; hidden and alias slugs get the site card. */
export default async function Image({ params }: { params: Promise<{ company: string }> }) {
  const ready = await oaReadyProblems();
  const data = oaLibrary().company((await params).company, new Set(ready.keys()));
  if (!data) return ogImage();
  const { slug, name, count, ready: judged } = data.company;
  const platform = slug === OTHER_COMPANY ? null : (mockPresetFor(slug)?.platform ?? null);
  return ogImage(oaCompanyOg({ slug, name: slug === OTHER_COMPANY ? 'Other' : name, count, ready: judged, platform }));
}
