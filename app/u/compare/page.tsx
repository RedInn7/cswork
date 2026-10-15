import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { seoMetadata } from '@/lib/seo';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { publicCatalogue, publicCompare } from '@/lib/server/learner-cloud';
import { requestLocale } from '@/lib/server/locale';
import { CompareView } from '../views';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const zh = (await requestLocale()) === 'zh';
  return {
    ...seoMetadata({
      title: zh ? '刷题对比 · CSWork' : 'Compare learners · CSWork',
      description: zh ? '并排比较公开主页的通过数和 500 路进度。' : 'Public profiles side by side: solved counts and Line 500 progress.',
      path: '/u/compare',
    }),
    // Any pair of handles makes a page: none of them belongs in search.
    robots: { index: false, follow: false },
  };
}

/**
 * /u/compare?a=&b=(&c=): two or three public profiles; any hidden or missing one is a 404. The
 * shared solved count needs the viewer among them, following each of the others both ways.
 */
export default async function CompareLearnersPage({ searchParams }: Props) {
  const q = await searchParams;
  const handles = [q.a, q.b, q.c].flatMap((v) => (typeof v === 'string' && v ? [v.toLowerCase()] : []));
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  const compare = publicCompare(handles, await publicCatalogue(), viewer?.id ?? null);
  if (!compare) notFound();
  return <CompareView compare={compare} zh={(await requestLocale()) === 'zh'} />;
}
