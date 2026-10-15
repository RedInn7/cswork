import { certificateOg, ogImage, OG_SIZE } from '@/lib/server/og-card';
import { certificateById } from '@/lib/server/certificates';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'CSWork certificate';

/** What the page shows (lib/server/certificates.ts certificateById); unknown ids get the site card. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const zh = certificateById(id, true);
  const en = certificateById(id, false);
  return ogImage(zh && en && certificateOg(zh, en));
}
