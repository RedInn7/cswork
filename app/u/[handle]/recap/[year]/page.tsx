import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { cache } from 'react';
import { seoMetadata } from '@/lib/seo';
import { publicCatalogue, publicYear } from '@/lib/server/learner-cloud';
import { requestLocale } from '@/lib/server/locale';
import { RecapView } from '../../../views';

type Props = { params: Promise<{ handle: string; year: string }> };

/** A hidden profile, or a year without a solve on it, is the profile's own 404. */
const load = cache(async (handle: string, year: string) => {
  const recap = /^\d{4}$/.test(year) ? publicYear(handle.toLowerCase(), Number(year), await publicCatalogue()) : null;
  if (!recap || !recap.years.includes(recap.year)) notFound();
  return { recap, zh: (await requestLocale()) === 'zh' };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle, year } = await params;
  const { recap, zh } = await load(handle, year);
  return {
    ...seoMetadata({
      title: zh ? `@${recap.handle} 的 ${recap.year} 年度刷题回顾 · CSWork` : `@${recap.handle}’s ${recap.year} in review · CSWork`,
      description: zh
        ? `@${recap.handle} 在 ${recap.year} 年通过了 ${recap.solved.total} 道题。`
        : `@${recap.handle} solved ${recap.solved.total} problems on CSWork in ${recap.year}.`,
      path: `/u/${recap.handle}/recap/${recap.year}`,
    }),
    // Follows the profile's own search setting.
    ...(recap.indexable ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function LearnerRecapPage({ params }: Props) {
  const { handle, year } = await params;
  return <RecapView {...await load(handle, year)} />;
}
