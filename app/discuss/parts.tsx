import { PublicLibraryMarkdown } from '../library/markdown';
import { publicPosts } from '@/lib/server/solution-posts';

export const day = (time: number, zh: boolean) =>
  new Date(time).toLocaleDateString(zh ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * Server-rendered answers or comments under a library page (the top five by votes), read as a
 * signed-out visitor; replying happens in the app at `appHref`.
 */
export async function PostsPreview({
  target,
  zh,
  title,
  appHref,
}: {
  target: string;
  zh: boolean;
  title: string;
  appHref: string;
}) {
  const page = await publicPosts(target, { body: '1' });
  const posts = page?.items.slice(0, 5) ?? [];
  return (
    <section className="public-library-next discuss-preview" aria-labelledby="discuss-preview-title">
      <h2 id="discuss-preview-title">
        {title}{' '}
        {!!page?.items.length && (
          <small>
            {page.items.length}
            {page.more ? '+' : ''}
          </small>
        )}
      </h2>
      {posts.length ? (
        <ol className="discuss-preview-list">
          {posts.map((post) => (
            <li key={post.id}>
              <p className="discuss-preview-meta">
                <span>{post.anonymous ? (zh ? '匿名用户' : 'Anonymous') : post.author || (zh ? '学员' : 'Learner')}</span>
                <span>{day(post.createdAt, zh)}</span>
                <span>{zh ? `${post.votes} 赞` : `${post.votes} ${post.votes === 1 ? 'upvote' : 'upvotes'}`}</span>
              </p>
              <div className="public-library-prose discuss-preview-body">
                <PublicLibraryMarkdown body={post.body ?? ''} math={false} ugc />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p>{zh ? '还没有人发言。' : 'Nothing here yet.'}</p>
      )}
      <a href={appHref}>{zh ? '在 CSWork 里参与 →' : 'Join in on CSWork →'}</a>
    </section>
  );
}
