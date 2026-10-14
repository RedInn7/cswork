import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { cache } from 'react';
import { levelOf, problemAppHref } from '@/lib/classic-lists';
import { problemTitle } from '@/lib/problems';
import { seoMetadata } from '@/lib/seo';
import { publicCatalogue, readList } from '@/lib/server/learner-cloud';
import { requestLocale } from '@/lib/server/locale';

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
  const { list, items, zh } = await load((await params).id);
  const t = (a: string, b: string) => (zh ? a : b);
  return (
    <article>
      <section className="lists-public-hero">
        <p className="lists-public-kicker">
          {list.owner ? (
            <>
              {t('题单 · 来自 ', 'List · by ')}
              <Link href={`/u/${list.owner}`} prefetch={false} className="learner-owner">
                @{list.owner}
              </Link>
            </>
          ) : (
            t('学习者题单', 'Learner list')
          )}
        </p>
        <h1>{list.title}</h1>
        {list.description && <p className="learner-description">{list.description}</p>}
        <div className="lists-public-meter">
          <span>
            <strong>{items.length}</strong> {t('道题', items.length === 1 ? 'problem' : 'problems')}
          </span>
        </div>
        <a className="lists-public-cta" href={`/?view=lists&list=${encodeURIComponent(list.id)}&utm_source=list`}>
          {t('复制到我的题单并开始练习', 'Copy it to my lists and practice')} →
        </a>
      </section>
      {items.length ? (
        <ol className="lists-public-rows learner-rows">
          {items.map(({ id, problem }, index) => {
            const level = levelOf(problem.difficulty);
            return (
              <li key={id}>
                <span className="lists-public-number">{index + 1}</span>
                <a href={problemAppHref(id)}>
                  {id.startsWith('lc-') ? `${id.slice(3)}. ` : ''}
                  {problemTitle(problem, zh ? 'zh' : 'en')}
                </a>
                <span className="lists-public-tags">
                  <span className="lists-public-judge">{id.startsWith('lc-') ? 'LeetCode' : 'OA'}</span>
                </span>
                <span className="lists-public-level" data-level={level?.[0]}>
                  {level ? (zh ? level[1] : level[2]) : ''}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="learner-empty">{t('这个题单还是空的。', 'This list is empty for now.')}</p>
      )}
    </article>
  );
}
