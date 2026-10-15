import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { CHANNELS, isChannel, threadPath, type Channel } from '@/lib/community';
import { seoMetadata } from '@/lib/seo';
import { reportCompanies } from '@/lib/server/learner-cloud';
import { requestLocale } from '@/lib/server/locale';
import { publicPosts } from '@/lib/server/solution-posts';
import { day } from './parts';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const PAGE = 30;
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');

/** ?channel= (a channel or all), &company=, &sort=new, &page=; anything else is a 404. */
const load = cache(async (channel: string, company: string, sort: string, page: number) => {
  if ((channel && !isChannel(channel)) || !/^[a-z0-9-]{0,80}$/.test(company) || !(page >= 1 && page <= 100))
    notFound();
  const companies = reportCompanies();
  if (company && !companies.some((c) => c.slug === company)) notFound();
  const result = await publicPosts(`discuss:${channel || 'all'}`, {
    sort: sort === 'new' ? 'new' : 'votes',
    tag: company,
    offset: String((page - 1) * PAGE),
  });
  if (!result) notFound();
  return { result, companies, zh: (await requestLocale()) === 'zh' };
});
async function read(searchParams: Props['searchParams']) {
  const q = await searchParams;
  const channel = one(q.channel);
  const company = one(q.company);
  const sort = one(q.sort) === 'new' ? 'new' : '';
  const page = Math.floor(Number(one(q.page) || 1));
  return { channel, company, sort, page, ...(await load(channel, company, sort, page)) };
}
const href = (q: Record<string, string | number>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(q)) if (value && value !== 1) params.set(key, String(value));
  const s = params.toString();
  return s ? `/discuss?${s}` : '/discuss';
};

export async function generateMetadata({ searchParams }: Props) {
  const { channel, company, sort, page, companies, zh } = await read(searchParams);
  const name = channel ? CHANNELS[channel as Channel][zh ? 0 : 1] : zh ? '讨论区' : 'Discussion board';
  const companyName = companies.find((c) => c.slug === company)?.name;
  return {
    ...seoMetadata({
      title: `${companyName ? `${companyName} · ` : ''}${name}${page > 1 ? ` · ${page}` : ''} · CSWork`,
      description: zh
        ? '面经讨论、算法、求职和上岸故事：CSWork 学员的讨论区。'
        : 'Interviews, algorithms, careers and offer stories: the CSWork discussion board.',
      path: href({ channel, company, page }),
    }),
    // The newest-first view repeats the default one.
    ...(sort ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function DiscussPage({ searchParams }: Props) {
  const { channel, company, sort, page, result, companies, zh } = await read(searchParams);
  const t = (a: string, b: string) => (zh ? a : b);
  const names = new Map(companies.map((c) => [c.slug, c.name]));
  const app = `/?${new URLSearchParams({ view: 'discuss', channel: channel || 'interview', ...(company ? { company } : {}) })}`;
  return (
    <article className="discuss-index">
      <section className="lists-public-hero">
        <p className="lists-public-kicker">{t('CSWork 社区', 'CSWork community')}</p>
        <h1>
          {channel ? CHANNELS[channel as Channel][zh ? 0 : 1] : t('讨论区', 'Discussion board')}
          {names.get(company) ? ` · ${names.get(company)}` : ''}
        </h1>
        <p>
          {channel
            ? CHANNELS[channel as Channel][zh ? 2 : 3]
            : t(
                '面经、算法、求职和上岸故事，按频道和公司分开聊。',
                'Interviews, algorithms, careers and offer stories, by channel and company.',
              )}
        </p>
        <a className="lists-public-cta" href={app}>
          {t('发帖或回复', 'Start or join a thread')} →
        </a>
      </section>

      <nav className="discuss-tabs" aria-label={t('频道', 'Channels')}>
        {(['', ...Object.keys(CHANNELS)] as ('' | Channel)[]).map((key) => (
          <Link
            key={key || 'all'}
            href={href({ channel: key, company, sort })}
            prefetch={false}
            aria-current={key === channel ? 'page' : undefined}
          >
            {key ? CHANNELS[key][zh ? 0 : 1] : t('全部', 'All')}
          </Link>
        ))}
      </nav>

      <form className="discuss-filters" action="/discuss" method="get">
        {channel && <input type="hidden" name="channel" value={channel} />}
        <label>
          <span>{t('公司', 'Company')}</span>
          <select name="company" defaultValue={company}>
            <option value="">{t('全部公司', 'All companies')}</option>
            {companies.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t('排序', 'Sort')}</span>
          <select name="sort" defaultValue={sort}>
            <option value="">{t('最热', 'Most votes')}</option>
            <option value="new">{t('最新', 'Newest')}</option>
          </select>
        </label>
        <button type="submit">{t('筛选', 'Apply')}</button>
      </form>

      {result.items.length ? (
        <ol className="discuss-rows">
          {result.items.map((post) => {
            const key = post.problemId.slice('discuss:'.length) as Channel;
            return (
              <li key={post.id}>
                <Link href={threadPath(post.id)} prefetch={false} className="discuss-row-title">
                  {post.title}
                </Link>
                <p className="discuss-row-meta">
                  {!channel && isChannel(key) && <span className="discuss-chip">{CHANNELS[key][zh ? 0 : 1]}</span>}
                  {post.tag && names.has(post.tag) && (
                    <span className="discuss-chip" data-company>
                      {names.get(post.tag)}
                    </span>
                  )}
                  {post.pinned && <span className="discuss-chip">{t('精选', 'Featured')}</span>}
                  <span>{post.anonymous ? t('匿名用户', 'Anonymous') : post.author || t('学员', 'Learner')}</span>
                  <span>{day(post.createdAt, zh)}</span>
                  <span>{t(`${post.votes} 赞`, `${post.votes} ${post.votes === 1 ? 'upvote' : 'upvotes'}`)}</span>
                  <span>{t(`${post.comments} 回复`, `${post.comments} ${post.comments === 1 ? 'reply' : 'replies'}`)}</span>
                </p>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="discuss-empty">{t('这里还没有帖子，来开个头吧。', 'No threads here yet. Start one.')}</p>
      )}
      {(page > 1 || result.more) && (
        <nav className="discuss-pager" aria-label={t('分页', 'Pagination')}>
          {page > 1 && (
            <Link href={href({ channel, company, sort, page: page - 1 })} prefetch={false}>
              ← {t('上一页', 'Previous')}
            </Link>
          )}
          <span>{t(`第 ${page} 页`, `Page ${page}`)}</span>
          {result.more && (
            <Link href={href({ channel, company, sort, page: page + 1 })} prefetch={false}>
              {t('下一页', 'Next')} →
            </Link>
          )}
        </nav>
      )}
    </article>
  );
}
