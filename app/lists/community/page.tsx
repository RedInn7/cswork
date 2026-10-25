import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { seoMetadata } from '@/lib/seo';
import { communityLists } from '@/lib/server/learner-cloud';
import { requestLocale } from '@/lib/server/locale';
import '../../u/u.css';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');

async function load(searchParams: Props['searchParams']) {
  const q = await searchParams;
  const page = Math.floor(Number(one(q.page) || 1));
  if (!(page >= 1 && page <= 200)) notFound();
  return {
    result: communityLists({ sort: one(q.sort), q: one(q.q), page }),
    zh: (await requestLocale()) === 'zh',
  };
}
const href = (q: Record<string, string | number>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(q)) if (value && value !== 1 && value !== 'hot') params.set(key, String(value));
  const s = params.toString();
  return s ? `/lists/community?${s}` : '/lists/community';
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { result, zh } = await load(searchParams);
  return {
    ...seoMetadata({
      title: zh ? '题单广场：学习者公开的题单 · CSWork' : 'Community lists: problem lists learners shared · CSWork',
      description: zh
        ? 'CSWork 学习者整理并公开的题单，按收藏和复制次数排序，可以一键复制到自己的题单。'
        : 'Problem lists CSWork learners made public, ranked by saves and copies. Copy one to your own lists.',
      path: '/lists/community',
    }),
    // Searches, other orders and later pages repeat the first page's lists.
    ...(result.q || result.sort === 'new' || result.page > 1 ? { robots: { index: false, follow: true } } : {}),
  };
}

/** /lists/community: every public learner list with problems in it, hot or newest, by title. */
export default async function CommunityLists({ searchParams }: Props) {
  const { result, zh } = await load(searchParams);
  const t = (a: string, b: string) => (zh ? a : b);
  const { q, sort, page } = result;
  return (
    <>
      <section className="lists-public-hero">
        <p className="lists-public-kicker">{t('题单广场', 'Community lists')}</p>
        <h1>{t('同学们整理的题单。', 'Lists other learners made.')}</h1>
        <p>
          {t(
            '这里是所有公开的学习者题单。收藏留着以后练，或者复制一份按自己的节奏改。',
            'Every public learner list. Save one for later, or copy it and make it your own.',
          )}
        </p>
      </section>
      <section aria-labelledby="plaza-title">
        <h2 id="plaza-title" className="lists-public-h2">
          {q ? t(`搜索「${q}」`, `Lists matching “${q}”`) : t('全部公开题单', 'All public lists')}
        </h2>
        <form className="plaza-tools" action="/lists/community" method="get">
          <label>
            <span className="sr-only">{t('按标题搜索', 'Search by title')}</span>
            <input name="q" defaultValue={q} maxLength={80} placeholder={t('按标题搜索', 'Search by title')} />
          </label>
          <label>
            <span className="sr-only">{t('排序', 'Sort')}</span>
            <select name="sort" defaultValue={sort}>
              <option value="hot">{t('最热', 'Popular')}</option>
              <option value="new">{t('最新', 'Newest')}</option>
            </select>
          </label>
          <button type="submit">{t('搜索', 'Search')}</button>
        </form>
        {result.items.length ? (
          <ol className="lists-public-rows plaza-rows">
            {result.items.map((l) => (
              <li key={l.id}>
                <span className="lists-public-number" aria-hidden="true">
                  ★
                </span>
                <span className="plaza-main">
                  <a href={`/u/lists/${l.id}`}>{l.title}</a>
                  <small>
                    {l.owner ? (
                      <a href={`/u/${l.owner}`} className="learner-owner">
                        @{l.owner}
                      </a>
                    ) : (
                      t('学习者', 'A learner')
                    )}
                    {' · '}
                    {t(`${l.count} 题`, `${l.count} ${l.count === 1 ? 'problem' : 'problems'}`)}
                  </small>
                </span>
                <span className="plaza-counts">
                  <span>{t(`${l.stars} 收藏`, `${l.stars} ${l.stars === 1 ? 'save' : 'saves'}`)}</span>
                  <span>{t(`${l.forks} 复制`, `${l.forks} ${l.forks === 1 ? 'copy' : 'copies'}`)}</span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="learner-empty">
            {q ? t('没有找到这个标题的题单。', 'No list has that in its title.') : t('还没有公开的题单。', 'No public lists yet.')}
          </p>
        )}
        {(page > 1 || result.more) && (
          <nav className="plaza-pager" aria-label={t('分页', 'Pagination')}>
            {page > 1 && (
              <Link href={href({ q, sort, page: page - 1 })} prefetch={false}>
                ← {t('上一页', 'Previous')}
              </Link>
            )}
            <span>{t(`第 ${page} 页`, `Page ${page}`)}</span>
            {result.more && (
              <Link href={href({ q, sort, page: page + 1 })} prefetch={false}>
                {t('下一页', 'Next')} →
              </Link>
            )}
          </nav>
        )}
      </section>
    </>
  );
}
