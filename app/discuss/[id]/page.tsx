import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { PublicLibraryMarkdown } from '../../library/markdown';
import { CHANNELS, INDEX_VOTES, isChannel, targetKind, threadPath } from '@/lib/community';
import { seoMetadata } from '@/lib/seo';
import { reportCompanies } from '@/lib/server/learner-cloud';
import { requestLocale } from '@/lib/server/locale';
import { publicPost } from '@/lib/server/solution-posts';
import { day } from '../parts';

type Props = { params: Promise<{ id: string }> };

/** Threads only: solutions, answers and comments, hidden or missing posts are all the same 404. */
const load = cache(async (id: string) => {
  const found = await publicPost(id);
  if (!found || targetKind(found.post.problemId) !== 'discuss') notFound();
  const channel = found.post.problemId.slice('discuss:'.length);
  if (!isChannel(channel)) notFound();
  const company = found.post.tag ? reportCompanies().find((c) => c.slug === found.post.tag) : undefined;
  return { ...found, channel, company, zh: (await requestLocale()) === 'zh' };
});

export async function generateMetadata({ params }: Props) {
  const { post, channel, zh } = await load((await params).id);
  return {
    ...seoMetadata({
      title: `${post.title} · ${CHANNELS[channel][zh ? 0 : 1]} · CSWork`,
      description: (post.body ?? '').replace(/[#>*_`~[\]()|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 160),
      path: threadPath(post.id),
    }),
    // A new thread stays out of search until readers vouch for it.
    ...(post.votes < INDEX_VOTES ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function ThreadPage({ params }: Props) {
  const { post, comments, channel, company, zh } = await load((await params).id);
  const t = (a: string, b: string) => (zh ? a : b);
  const app = `/?${new URLSearchParams({ view: 'discuss', channel, post: post.id })}`;
  return (
    <article className="discuss-thread">
      <nav className="lists-public-crumbs" aria-label={t('导航路径', 'Breadcrumb')}>
        <Link href="/discuss" prefetch={false}>
          {t('讨论区', 'Discussion board')}
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={`/discuss?channel=${channel}`} prefetch={false}>
          {CHANNELS[channel][zh ? 0 : 1]}
        </Link>
        {company && (
          <>
            <span aria-hidden="true">/</span>
            <Link href={`/discuss?${new URLSearchParams({ channel, company: company.slug })}`} prefetch={false}>
              {company.name}
            </Link>
          </>
        )}
      </nav>
      <header className="discuss-thread-head">
        <h1>{post.title}</h1>
        <p className="discuss-row-meta">
          <span>{post.author || t('学员', 'Learner')}</span>
          <span>{day(post.createdAt, zh)}</span>
          {post.updatedAt > post.createdAt + 60000 && <span>{t('已编辑', 'edited')}</span>}
          <span>{t(`${post.votes} 赞`, `${post.votes} ${post.votes === 1 ? 'upvote' : 'upvotes'}`)}</span>
        </p>
      </header>
      <div className="public-library-prose discuss-thread-body">
        <PublicLibraryMarkdown body={post.body ?? ''} math={false} ugc />
      </div>
      {/* A poll's options; counts only once it has closed (voting happens in the app). */}
      {post.poll && (
        <section aria-labelledby="discuss-poll">
          <h2 id="discuss-poll" className="lists-public-h2">
            {t('投票：', 'Poll: ')}
            {post.poll.question}
          </h2>
          <ul>
            {post.poll.options.map((option, i) => (
              <li key={i}>
                {option}
                {post.poll?.counts && ` · ${t(`${post.poll.counts[i]} 票`, `${post.poll.counts[i]} votes`)}`}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p>
        <a className="lists-public-cta" href={app}>
          {post.poll && !post.poll.closed
            ? t('在 CSWork 里投票、回复或点赞', 'Vote, reply or upvote on CSWork')
            : t('在 CSWork 里回复或点赞', 'Reply or upvote on CSWork')}{' '}
          →
        </a>
      </p>
      <section aria-labelledby="discuss-replies">
        <h2 id="discuss-replies" className="lists-public-h2">
          {t('回复', 'Replies')} <small>{comments.length}</small>
        </h2>
        {comments.length ? (
          <ol className="discuss-replies">
            {comments.map((c) => (
              <li key={c.id}>
                <p className="discuss-row-meta">
                  <strong>{c.author || t('学员', 'Learner')}</strong>
                  <span>{day(c.createdAt, zh)}</span>
                </p>
                {/* Replies are plain text, as in the app. */}
                <p className="discuss-reply-body">{c.body}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="discuss-empty">{t('还没有回复。', 'No replies yet.')}</p>
        )}
      </section>
    </article>
  );
}
