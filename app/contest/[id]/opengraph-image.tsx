import { contestOg, ogImage, OG_SIZE } from '@/lib/server/og-card';
import { contestCard } from '@/lib/server/contests';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'CSWork contest';

/** Only weeklies and starters get a card; private rooms and duels get the site card. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const card = contestCard((await params).id);
  return ogImage(card && contestOg(card));
}
