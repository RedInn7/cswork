import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { cache } from 'react';
import { seoMetadata } from '@/lib/seo';
import { publicCatalogue, readList } from '@/lib/server/learner-cloud';
import { requestLocale } from '@/lib/server/locale';
import { PublicListView } from '../../views';

type Props = { params: Promise<{ id: string }> };

/** Public lists only: a private or missing list is the same 404. */
const load = cache(async (id: string) => {
  const list = readList(id, null);
  if (!list) notFound();
  const catalogue = await publicCatalogue();
  // Problems unpublished since they were added drop out quietly.
  const items = list.items.flatMap((i) => {
    const p = catalogue.get(i.problemId);
    return p ? [{ id: i.problemId, problem: p }] : [];
  });
  return { list, items, zh: (await requestLocale()) === 'zh' };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { list, items, zh } = await load((await params).id);
  return {
    ...seoMetadata({
      title: zh ? `${list.title}：${items.length} 道题的题单 · CSWork` : `${list.title}: a ${items.length}-problem list · CSWork`,
      description: list.description || (zh ? `CSWork 学习者整理的题单，共 ${items.length} 题。` : `A ${items.length}-problem list made by a CSWork learner.`),
      path: `/u/lists/${list.id}`,
    }),
    // Learner-made lists stay out of search.
    robots: { index: false, follow: true },
  };
}

export default async function PublicListPage({ params }: Props) {
  return <PublicListView {...await load((await params).id)} />;
}
