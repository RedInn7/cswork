import { ogImage, OG_SIZE, profileOg } from '@/lib/server/og-card';
import { profileCard, publicCatalogue } from '@/lib/server/learner-cloud';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'CSWork learner profile';

/** Hidden, missing and switched-off profiles get the site card: nothing says an account exists. */
export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const card = profileCard((await params).handle.toLowerCase(), await publicCatalogue());
  return ogImage(card && profileOg(card));
}
