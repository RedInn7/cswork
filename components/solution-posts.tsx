'use client';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowLeft,
  Bookmark,
  EyeOff,
  Lightbulb,
  Lock,
  MessageSquare,
  Pencil,
  RefreshCw,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '@/lib/types';
import { useLocale } from '@/lib/i18n';
import { targetKind, threadPath, type TargetKind } from '@/lib/community';
import { STOP_NAMES } from '@/lib/route-stops';
import { StatementMarkdown } from './statement-markdown';
import { Report } from './chat-log';
import { Button } from './ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import '@/app/solution-posts.css';

type T = (zh: string, en: string) => string;
export type PostSummary = {
  id: string;
  problemId: string;
  title: string;
  language: string;
  /** A company slug on a thread, a Line 500 stop (technique) on a solution. */
  tag?: string;
  hidden: number;
  createdAt: number;
  updatedAt: number;
  author: string;
  mine: boolean;
  votes: number;
  voted: boolean;
  comments: number;
  /** How many readers saved it, and whether this one did. */
  stars?: number;
  starred?: boolean;
  excerpt?: string;
  /** The author's verified employer, where they show the badge on posts. */
  employer?: string | null;
  /** A referral thread by a verified employee of its company: it takes referral requests. */
  referral?: boolean;
};
/** A thread's poll; counts arrive once this reader has voted or it has closed. */
export type Poll = {
  question: string;
  options: string[];
  multi: boolean;
  closesAt: number | null;
  closed: boolean;
  voters: number;
  mine: number[];
  counts: number[] | null;
};
type Comment = { id: string; body: string; createdAt: number; author: string; mine: boolean };
type Detail = { post: PostSummary & { body: string; poll?: Poll | null }; comments: Comment[] };
/** `next`: the saved list's raw offset (it can drop rows it no longer shows). */
type Page = { solved: boolean; items: PostSummary[]; more: boolean; next?: number };
type Confirm = { title: string; description: string; action: string; run: () => void };

// Same caps as lib/server/solution-posts.ts; the server is the one that enforces them.
const TITLE_MAX = 120;
const BODY_MAX = 20000;
const COMMENT_MAX = 1000;
const POLL_OPTIONS = 6;
const POLL_OPTION_MAX = 80;
// hidden: 2 is a moderator's hide (an author's own removal never comes back from the server).
const MODERATED = 2;
const LANGS: [string, string][] = [
  ['python', 'Python'],
  ['cpp', 'C++'],
  ['java', 'Java'],
  ['go', 'Go'],
];
const langName = (id: string) => LANGS.find(([key]) => key === id)?.[1] ?? '';
/** A date input's value (YYYY-MM-DD) for a time, in the reader's time zone. */
const localDate = (time: number) => {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const day = (time: number, english: boolean) =>
  new Date(time).toLocaleDateString(english ? 'en-US' : 'zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
/** The list's two-line teaser: code blocks and Markdown marks dropped, rendered as text. */
export const plainExcerpt = (md: string) =>
  md
    .replace(/(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:\1|$)/g, ' ')
    .replace(/[#>*_`~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
/** A fence longer than any backtick run inside the code, so pasted code cannot close it early. */
export function codeBlock(code: string, language: string) {
  const run = Math.max(0, ...[...code.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = '`'.repeat(Math.max(3, run + 1));
  return `${fence}${language}\n${code.replace(/\n+$/, '')}\n${fence}`;
}
/** Copy that changes with what the posts hang off: [zh, en]. */
const WORDS: Record<
  TargetKind,
  { label: [string, string]; write: [string, string]; all: [string, string]; empty: [string, string]; loading: [string, string] }
> = {
  problem: {
    label: ['社区题解', 'Community solutions'],
    write: ['写题解', 'Write a solution'],
    all: ['全部题解', 'All solutions'],
    empty: ['还没有题解，来写第一篇吧。', 'No solutions yet. Be the first to share one.'],
    loading: ['正在加载题解…', 'Loading solutions…'],
  },
  discuss: {
    label: ['讨论', 'Discussion'],
    write: ['发帖', 'New thread'],
    all: ['全部帖子', 'All threads'],
    empty: ['这里还没有帖子，来开个头吧。', 'No threads here yet. Start one.'],
    loading: ['正在加载帖子…', 'Loading threads…'],
  },
  q: {
    label: ['社区回答', 'Community answers'],
    write: ['写我的回答', 'Write your answer'],
    all: ['全部回答', 'All answers'],
    empty: ['还没有人分享回答。', 'No one has shared an answer yet.'],
    loading: ['正在加载回答…', 'Loading answers…'],
  },
  exp: {
    label: ['评论', 'Comments'],
    write: ['写评论', 'Add a comment'],
    all: ['全部评论', 'All comments'],
    empty: ['还没有评论。', 'No comments yet.'],
    loading: ['正在加载评论…', 'Loading comments…'],
  },
  sd: {
    label: ['章节讨论', 'Chapter discussion'],
    write: ['参与讨论', 'Join the discussion'],
    all: ['全部讨论', 'All comments'],
    empty: ['这一章还没有讨论，来提第一个问题吧。', 'No discussion on this chapter yet. Ask the first question.'],
    loading: ['正在加载讨论…', 'Loading the discussion…'],
  },
};
/** Line 500 stops, the techniques a solution can be tagged with, in line order. */
const TECHNIQUES = Object.entries(STOP_NAMES);
type Company = { slug: string; name: string };
let companiesRequest: Promise<Company[]> | null = null;
/** The companies a thread may be tagged with (the server's company pages), fetched once. */
export function threadCompanies() {
  companiesRequest ??= api<{ items: Company[] }>('oj/reports/companies').then(
    (r) => (Array.isArray(r.items) ? r.items : []),
    () => {
      // A failed request is tried again next time.
      companiesRequest = null;
      return [];
    },
  );
  return companiesRequest;
}
function useCompanies(on: boolean) {
  const [companies, setCompanies] = useState<Company[]>([]);
  useEffect(() => {
    if (!on) return;
    let live = true;
    void threadCompanies().then((c) => live && setCompanies(c));
    return () => {
      live = false;
    };
  }, [on]);
  return companies;
}
/** A post's tag as a label: the technique's or the company's name. */
function tagLabel(tag: string | undefined, kind: TargetKind, english: boolean, companies: Company[]) {
  if (!tag) return '';
  if (kind === 'problem') return Object.hasOwn(STOP_NAMES, tag) ? STOP_NAMES[tag][english ? 1 : 0] : '';
  return companies.find((c) => c.slug === tag)?.name ?? tag;
}
// Academy cancels this and opens its sign-in sheet; a page without it (a system design chapter)
// sends the reader to the account page instead.
const authRequired = () => {
  if (window.dispatchEvent(new Event('cswork:auth-required', { cancelable: true }))) location.assign('/?view=account');
};
/** "Verified · X employee", and on a referral thread "Gives referrals". */
function Badges({ post, t }: { post: PostSummary; t: T }) {
  return (
    <>
      {post.employer && (
        <span className="cs-post-badge">{t(`已验证 · ${post.employer} 员工`, `Verified · ${post.employer} employee`)}</span>
      )}
      {post.referral && <span className="cs-post-badge" data-referral>{t('可内推', 'Gives referrals')}</span>}
    </>
  );
}
const peekKey = (problemId: string) => `cswork:solutions-peek:${problemId}`;
function readPeek(problemId: string) {
  try {
    return sessionStorage.getItem(peekKey(problemId)) === '1';
  } catch {
    return false;
  }
}

/** The left pane's tab button. */
export function SolutionsTab({
  active,
  onSelect,
  english,
}: {
  active: boolean;
  onSelect: () => void;
  english: boolean;
}) {
  return (
    <button role="tab" aria-selected={active} className={active ? 'active' : ''} onClick={onSelect}>
      <Lightbulb size={15} />
      {english ? 'Solutions' : '题解'}
    </button>
  );
}

/**
 * Community posts on one target (lib/community.ts). On a problem: solutions, locked until the
 * learner has an AC (or confirms they want to look, or `unlocked`: under an editorial already
 * opened), filterable by technique. Elsewhere: a channel's threads (`tag` filters them by
 * company), answers to a question, comments on an experience or a system design chapter's
 * discussion, never locked. Then a list by votes or date (or the reader's saved posts from
 * anywhere), one post with its comments, and an editor. `code`/`language` are the workspace
 * editor's, offered as the new post's code. Signed out (`signedIn` false) reading works where
 * the server allows it; writing and saving ask to sign in.
 */
export function SolutionPosts({
  problemId,
  english,
  code = '',
  language = '',
  only = '',
  tag = '',
  initialPost,
  signedIn = true,
  unlocked = false,
}: {
  problemId: string;
  english: boolean;
  code?: string;
  language?: string;
  /** Opened from the AC dialog's histogram: that language's posts first; the chip clears it. */
  only?: string;
  tag?: string;
  /** Open this post first (a link from a thread's page). */
  initialPost?: string;
  signedIn?: boolean;
  unlocked?: boolean;
}) {
  const t: T = (zh, en) => (english ? en : zh);
  // The UI only mounts on known targets (the server refuses the rest).
  const kind = targetKind(problemId) ?? 'problem';
  const words = WORDS[kind];
  // The reader's saved posts, from any target, in place of this target's list.
  const [saved, setSaved] = useState(false);
  const companies = useCompanies(kind === 'discuss' || saved);
  const [technique, setTechnique] = useState('');
  const filter = kind === 'problem' ? technique : tag;
  const [sort, setSort] = useState<'votes' | 'new'>('votes');
  // Opened from the AC dialog's histogram: one language's posts until the chip clears it.
  const [langFilter, setLangFilter] = useState(() => (langName(only) ? only : ''));
  const query = saved
    ? 'oj/posts?starred=1'
    : `oj/posts?problem=${encodeURIComponent(problemId)}${filter ? `&tag=${encodeURIComponent(filter)}` : ''}&sort=${sort}${langFilter ? `&language=${langFilter}` : ''}`;
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [peek, setPeek] = useState(() => unlocked || readPeek(problemId));
  const [view, setView] = useState<
    { kind: 'list' } | { kind: 'post'; id: string } | { kind: 'edit'; post: Detail['post'] | null }
  >(() => (initialPost ? { kind: 'post', id: initialPost } : { kind: 'list' }));
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  useEffect(() => {
    let live = true;
    setError('');
    api<Page>(query).then(
      (p) => live && setPage(p),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [query, reload]);
  async function more() {
    if (!page) return;
    setLoadingMore(true);
    try {
      const next = await api<Page>(`${query}&offset=${page.next ?? page.items.length}`);
      setPage({ ...next, items: [...page.items, ...next.items.filter((n) => !page.items.some((p) => p.id === n.id))] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }
  const back = () => {
    setView({ kind: 'list' });
    setReload((n) => n + 1);
  };
  const dialog = (
    <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('取消', 'Cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              confirm?.run();
              setConfirm(null);
            }}
          >
            {confirm?.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  let body: ReactNode;
  if (view.kind === 'post')
    body = (
      <PostView
        id={view.id}
        english={english}
        onBack={back}
        onEdit={(post) => setView({ kind: 'edit', post })}
        ask={setConfirm}
        backLabel={saved ? t('我的收藏', 'Saved posts') : t(...words.all)}
        tagName={(value, postKind) => tagLabel(value, postKind, english, companies)}
        signedIn={signedIn}
      />
    );
  else if (view.kind === 'edit')
    body = (
      <PostEditor
        problemId={view.post?.problemId ?? problemId}
        english={english}
        initial={view.post}
        code={code}
        language={language}
        companies={companies}
        defaultTag={tag}
        onCancel={() => (view.post ? setView({ kind: 'post', id: view.post.id }) : setView({ kind: 'list' }))}
        onSaved={(id) => setView({ kind: 'post', id })}
      />
    );
  else if (!page)
    body = error ? (
      <div className="cs-posts-state" role="alert">
        <p>
          {t('题解加载失败。', "Couldn't load solutions.")} {error}
        </p>
        <button type="button" onClick={() => setReload((n) => n + 1)}>
          {t('重试', 'Retry')}
        </button>
      </div>
    ) : (
      <output className="cs-posts-state">{t(...words.loading)}</output>
    );
  else if (!page.solved && !peek)
    body = (
      <div className="cs-posts-locked">
        <Lock size={18} aria-hidden="true" />
        <div>
          <strong>{t('先自己做出来', 'Solve it first')}</strong>
          <p>
            {t(
              '通过这道题后题解自动解锁。自己想出来的解法，面试时才记得住。',
              'Solutions unlock once you pass this problem. The approach you find yourself is the one you remember in an interview.',
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setConfirm({
              title: t('现在查看题解？', 'Show solutions now?'),
              description: t(
                '你还没有通过这道题。题解会直接给出别人的完整解法。',
                "You haven't passed this problem yet. Solutions show other learners' complete answers.",
              ),
              action: t('查看题解', 'Show solutions'),
              run() {
                try {
                  sessionStorage.setItem(peekKey(problemId), '1');
                } catch {}
                setPeek(true);
              },
            })
          }
        >
          {t('仍要查看', 'Show anyway')}
        </button>
      </div>
    );
  else
    body = (
      <>
        <header className="cs-posts-head">
          {!saved && (
            <fieldset className="cs-posts-sort">
              <legend className="sr-only">{t('排序', 'Sort by')}</legend>
              <button type="button" aria-pressed={sort === 'votes'} onClick={() => setSort('votes')}>
                {t('最热', 'Most votes')}
              </button>
              <button type="button" aria-pressed={sort === 'new'} onClick={() => setSort('new')}>
                {t('最新', 'Newest')}
              </button>
            </fieldset>
          )}
          {signedIn && (
            <button type="button" className="cs-post-act" aria-pressed={saved} onClick={() => setSaved((on) => !on)}>
              <Bookmark size={13} aria-hidden="true" />
              {t('我的收藏', 'Saved')}
            </button>
          )}
          {!saved && langFilter && (
            <button
              type="button"
              className="cs-posts-lang-filter"
              aria-label={t(`清除筛选：只看 ${langName(langFilter)}`, `Clear filter: ${langName(langFilter)} only`)}
              onClick={() => setLangFilter('')}
            >
              {t(`只看 ${langName(langFilter)}`, `${langName(langFilter)} only`)}
              <X size={12} aria-hidden="true" />
            </button>
          )}
          {!saved && kind === 'problem' && (
            <label className="cs-posts-filter">
              <span className="sr-only">{t('按技巧筛选', 'Filter by technique')}</span>
              <select value={technique} onChange={(e) => setTechnique(e.target.value)}>
                <option value="">{t('全部技巧', 'All techniques')}</option>
                {TECHNIQUES.map(([slug, [zh, en]]) => (
                  <option key={slug} value={slug}>
                    {english ? en : zh}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            className="cs-posts-write"
            onClick={() => (signedIn ? setView({ kind: 'edit', post: null }) : authRequired())}
          >
            <Pencil size={14} aria-hidden="true" />
            {t(...words.write)}
          </button>
        </header>
        {error && (
          <p className="cs-posts-error" role="alert">
            {error}
          </p>
        )}
        {page.items.length ? (
          <ul className="cs-posts-list">
            {page.items.map((post) => {
              const postKind = targetKind(post.problemId) ?? 'problem';
              return (
              <li key={post.id}>
                <button type="button" className="cs-post-row" onClick={() => setView({ kind: 'post', id: post.id })}>
                  {/* Answers and comments are titled by their first line: the excerpt says it all,
                      except among saved posts from everywhere. */}
                  {(saved || kind === 'problem' || kind === 'discuss') && (
                    <span className="cs-post-row-title">{post.title}</span>
                  )}
                  {post.excerpt && <span className="cs-post-row-excerpt">{plainExcerpt(post.excerpt)}</span>}
                  <span className="cs-post-row-meta">
                    {saved && <span className="cs-post-lang">{t(...POST_KINDS[postKind])}</span>}
                    <span>{post.author || t('学员', 'Learner')}</span>
                    <Badges post={post} t={t} />
                    <span>{day(post.createdAt, english)}</span>
                    {post.language && <span className="cs-post-lang">{langName(post.language)}</span>}
                    {post.tag && <span className="cs-post-tag">{tagLabel(post.tag, postKind, english, companies)}</span>}
                    {post.hidden === MODERATED && (
                      <span className="cs-post-flag">{t('已被隐藏', 'Hidden')}</span>
                    )}
                    <span className="cs-post-count" data-on={post.voted || undefined}>
                      <ThumbsUp size={13} aria-hidden="true" />
                      <span className="sr-only">{t('赞', 'Votes')}</span>
                      {post.votes}
                    </span>
                    <span className="cs-post-count">
                      <MessageSquare size={13} aria-hidden="true" />
                      <span className="sr-only">{t('评论', 'Comments')}</span>
                      {post.comments}
                    </span>
                  </span>
                </button>
              </li>
              );
            })}
          </ul>
        ) : (
          <p className="cs-posts-state">
            {saved
              ? t('还没有收藏帖子。打开一篇帖子，点「收藏」就会出现在这里。', 'No saved posts yet. Open a post and choose Save to keep it here.')
              : t(...words.empty)}
          </p>
        )}
        {page.more && (
          <button type="button" className="cs-posts-more" disabled={loadingMore} onClick={() => void more()}>
            {loadingMore ? t('正在加载…', 'Loading…') : t('加载更多', 'Load more')}
          </button>
        )}
      </>
    );
  return (
    <section className="cs-posts" aria-label={t(...words.label)}>
      {body}
      {dialog}
    </section>
  );
}

function PostView({
  id,
  english,
  onBack,
  onEdit,
  ask,
  backLabel,
  tagName,
  signedIn,
}: {
  id: string;
  english: boolean;
  onBack: () => void;
  onEdit: (post: Detail['post']) => void;
  ask: (confirm: Confirm) => void;
  backLabel: string;
  tagName: (tag: string | undefined, kind: TargetKind) => string;
  signedIn: boolean;
}) {
  const t: T = (zh, en) => (english ? en : zh);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    api<Detail>(`oj/posts/${encodeURIComponent(id)}`).then(
      (d) => live && setDetail(d),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [id]);
  const backButton = (
    <button type="button" className="cs-posts-back" onClick={onBack}>
      <ArrowLeft size={14} aria-hidden="true" />
      {backLabel}
    </button>
  );
  if (!detail)
    return (
      <>
        {backButton}
        {error ? (
          <p className="cs-posts-state" role="alert">
            {error}
          </p>
        ) : (
          <output className="cs-posts-state">{t('正在加载…', 'Loading…')}</output>
        )}
      </>
    );
  const { post } = detail;
  const postKind = targetKind(post.problemId) ?? 'problem';
  async function save() {
    if (!signedIn) return authRequired();
    const on = !post.starred;
    setError('');
    try {
      await api('oj/marks', { target: `post:${post.id}`, mark: 'star', on });
      setDetail((d) => d && { ...d, post: { ...d.post, starred: on, stars: (d.post.stars ?? 0) + (on ? 1 : -1) } });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function vote() {
    if (!signedIn) return authRequired();
    const on = !post.voted;
    setError('');
    try {
      const r = await api<{ votes: number; voted: boolean }>(`oj/posts/${post.id}/vote`, { on });
      setDetail((d) => d && { ...d, post: { ...d.post, votes: r.votes, voted: r.voted } });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!signedIn) return authRequired();
    if (!comment.trim()) return;
    setBusy(true);
    setError('');
    try {
      setDetail(await api<Detail>(`oj/posts/${post.id}/comments`, { body: comment }));
      setComment('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const remove = (path: string, then: () => void) => async () => {
    try {
      await api(path, {});
      then();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <article className="cs-post">
      {backButton}
      {post.hidden === MODERATED && (
        <p className="cs-posts-notice" role="status">
          <EyeOff size={14} aria-hidden="true" />
          {t('这篇题解已被老师隐藏，只有你能看到。', 'An instructor hid this solution. Only you can see it.')}
        </p>
      )}
      {(postKind === 'problem' || postKind === 'discuss') && <h3 className="cs-post-title">{post.title}</h3>}
      <p className="cs-post-meta">
        <span>{post.author || t('学员', 'Learner')}</span>
        <Badges post={post} t={t} />
        <span>{day(post.createdAt, english)}</span>
        {post.updatedAt > post.createdAt + 60000 && <span>{t('已编辑', 'edited')}</span>}
        {post.language && <span className="cs-post-lang">{langName(post.language)}</span>}
        {post.tag && <span className="cs-post-tag">{tagName(post.tag, postKind)}</span>}
        {postKind === 'discuss' && post.hidden === 0 && (
          <a href={threadPath(post.id)}>{t('公开链接', 'Public link')}</a>
        )}
      </p>
      <StatementMarkdown body={post.body} untrusted diagrams className="cs-statement-markdown cs-post-body" />
      {post.poll && (
        <PostPoll
          postId={post.id}
          poll={post.poll}
          english={english}
          signedIn={signedIn}
          onVoted={(poll) => setDetail((d) => d && { ...d, post: { ...d.post, poll } })}
        />
      )}
      <div className="cs-post-actions">
        <button
          type="button"
          className="cs-post-act"
          data-vote
          aria-pressed={post.voted}
          disabled={post.mine}
          title={post.mine ? t('不能给自己的题解点赞', "You can't vote for your own solution") : undefined}
          onClick={() => void vote()}
        >
          <ThumbsUp size={14} aria-hidden="true" />
          <span className="sr-only">{t('点赞', 'Upvote')}</span>
          {post.votes}
        </button>
        <button type="button" className="cs-post-act" aria-pressed={!!post.starred} onClick={() => void save()}>
          <Bookmark size={14} aria-hidden="true" />
          {post.starred ? t('已收藏', 'Saved') : t('收藏', 'Save')}
          {!!post.stars && (
            <>
              <span className="sr-only">{t('，收藏人数', ', saved by')}</span>
              {post.stars}
            </>
          )}
        </button>
        {post.mine ? (
          <>
            <button type="button" className="cs-post-act" onClick={() => onEdit(post)}>
              <Pencil size={14} aria-hidden="true" />
              {t('编辑', 'Edit')}
            </button>
            <button
              type="button"
              className="cs-post-act"
              onClick={() =>
                ask({
                  title: t('删除这篇题解？', 'Delete this solution?'),
                  description: t('删除后其他人将看不到它，也不能恢复。', "Others won't see it any more, and it can't be restored."),
                  action: t('删除', 'Delete'),
                  run: () => void remove(`oj/posts/${post.id}/delete`, onBack)(),
                })
              }
            >
              <Trash2 size={14} aria-hidden="true" />
              {t('删除', 'Delete')}
            </button>
          </>
        ) : (
          signedIn && <Report path={`oj/posts/${post.id}/report`} english={english} />
        )}
        {post.referral && !post.mine && (
          <a
            className="cs-post-act cs-post-refer"
            href={`/?view=messages&post=${encodeURIComponent(post.id)}`}
            onClick={(e) => {
              if (signedIn) return;
              e.preventDefault();
              authRequired();
            }}
          >
            <MessageSquare size={14} aria-hidden="true" />
            {t('请求内推', 'Request a referral')}
          </a>
        )}
      </div>
      {error && (
        <p className="cs-posts-error" role="alert">
          {error}
        </p>
      )}
      <section className="cs-comments" aria-labelledby={`comments-${post.id}`}>
        <h4 id={`comments-${post.id}`}>
          {t('评论', 'Comments')} <span>{detail.comments.length}</span>
        </h4>
        {!!detail.comments.length && (
          <ul>
            {detail.comments.map((c) => (
              <li key={c.id}>
                <div className="cs-comment-meta">
                  <strong>{c.author || t('学员', 'Learner')}</strong>
                  <span>{day(c.createdAt, english)}</span>
                  {c.mine ? (
                    <button
                      type="button"
                      className="cs-post-act"
                      onClick={() =>
                        ask({
                          title: t('删除这条评论？', 'Delete this comment?'),
                          description: t('删除后不能恢复。', "It can't be restored."),
                          action: t('删除', 'Delete'),
                          run: () =>
                            void remove(`oj/post-comments/${c.id}/delete`, () =>
                              setDetail((d) => d && { ...d, comments: d.comments.filter((x) => x.id !== c.id) }),
                            )(),
                        })
                      }
                    >
                      <Trash2 size={13} aria-hidden="true" />
                      {t('删除', 'Delete')}
                    </button>
                  ) : (
                    signedIn && <Report path={`oj/post-comments/${c.id}/report`} english={english} />
                  )}
                </div>
                <p className="cs-comment-body">{c.body}</p>
              </li>
            ))}
          </ul>
        )}
        {post.hidden !== MODERATED && (
          <form className="cs-comment-form" onSubmit={(e) => void send(e)}>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={COMMENT_MAX}
              rows={3}
              aria-label={t('写评论', 'Write a comment')}
              placeholder={t('提问、补充或指出问题……', 'Ask, add, or point out a problem…')}
            />
            <button type="submit" disabled={busy || !comment.trim()}>
              {t('发表评论', 'Comment')}
            </button>
          </form>
        )}
      </section>
    </article>
  );
}

/** A thread's poll: pick and vote once, then bars of each option's share of the voters. */
function PostPoll({
  postId,
  poll,
  english,
  signedIn,
  onVoted,
}: {
  postId: string;
  poll: Poll;
  english: boolean;
  signedIn: boolean;
  onVoted: (poll: Poll) => void;
}) {
  const t: T = (zh, en) => (english ? en : zh);
  const [picks, setPicks] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const box = useRef<HTMLElement>(null);
  // The Vote button leaves with the form: focus the poll, whose status line reads the result.
  useEffect(() => {
    if (saved) box.current?.focus();
  }, [saved]);
  async function vote(event: FormEvent) {
    event.preventDefault();
    if (!signedIn) return authRequired();
    setBusy(true);
    setError('');
    try {
      onVoted((await api<{ poll: Poll }>(`oj/posts/${postId}/poll`, { choices: picks })).poll);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const counts = poll.counts;
  const meta = [
    saved && t('已投票', 'Vote saved'),
    t(`${poll.voters} 人已投票`, `${poll.voters} ${poll.voters === 1 ? 'voter' : 'voters'}`),
    poll.multi && t('可多选', 'Pick any'),
    poll.closed
      ? t('已截止', 'Closed')
      : poll.closesAt && t(`${day(poll.closesAt, false)}截止`, `Closes ${day(poll.closesAt, true)}`),
    !counts && t('投票后显示结果', 'Results show once you vote'),
  ].filter(Boolean);
  return (
    <section className="cs-poll" aria-labelledby={`poll-${postId}`} ref={box} tabIndex={-1}>
      <h4 id={`poll-${postId}`}>{poll.question}</h4>
      {counts ? (
        <ul className="cs-poll-results">
          {poll.options.map((option, i) => {
            const share = poll.voters ? Math.round((counts[i] / poll.voters) * 100) : 0;
            return (
              <li key={i} data-mine={poll.mine.includes(i) || undefined}>
                <span>
                  {option}
                  {poll.mine.includes(i) && <span className="cs-poll-mine">{t('你的选择', 'Your choice')}</span>}
                </span>
                <span className="cs-poll-count">
                  {share}% · {counts[i]}
                </span>
                <span className="cs-poll-bar" aria-hidden="true">
                  <span style={{ width: `${share}%` }} />
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <form className="cs-poll-form" onSubmit={(e) => void vote(e)}>
          <fieldset>
            <legend className="sr-only">{poll.question}</legend>
            {poll.options.map((option, i) => (
              <label key={i}>
                <input
                  type={poll.multi ? 'checkbox' : 'radio'}
                  name={`poll-${postId}`}
                  checked={picks.includes(i)}
                  onChange={(e) =>
                    setPicks(poll.multi ? (e.target.checked ? [...picks, i] : picks.filter((x) => x !== i)) : [i])
                  }
                />
                {option}
              </label>
            ))}
          </fieldset>
          <button type="submit" disabled={busy || !picks.length}>
            {t('投票', 'Vote')}
          </button>
        </form>
      )}
      <p className="cs-poll-meta" role="status">
        {meta.join(' · ')}
      </p>
      {error && (
        <p className="cs-posts-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function PostEditor({
  problemId,
  english,
  initial,
  code,
  language,
  companies,
  defaultTag,
  onCancel,
  onSaved,
}: {
  problemId: string;
  english: boolean;
  initial: Detail['post'] | null;
  code: string;
  language: string;
  companies: Company[];
  defaultTag: string;
  onCancel: () => void;
  onSaved: (id: string) => void;
}) {
  const t: T = (zh, en) => (english ? en : zh);
  const kind = targetKind(problemId) ?? 'problem';
  const solution = kind === 'problem';
  // Answers and comments have no title or language of their own.
  const titled = solution || kind === 'discuss';
  const editorLang = langName(language) ? language : '';
  const [title, setTitle] = useState(initial?.title ?? '');
  const [lang, setLang] = useState(initial ? initial.language : editorLang);
  const [tag, setTag] = useState(initial ? (initial.tag ?? '') : defaultTag);
  // A new solution starts from a short outline with the editor's code already in it.
  const [body, setBody] = useState(
    () =>
      initial?.body ??
      (!solution
        ? ''
        : [
        t('## 思路', '## Approach'),
        '',
        '',
        t('## 复杂度', '## Complexity'),
        '',
        t('- 时间：O()', '- Time: O()'),
        t('- 空间：O()', '- Space: O()'),
        '',
        t('## 代码', '## Code'),
        '',
        code.trim() ? codeBlock(code, editorLang) : '',
      ].join('\n')),
  );
  // A thread's poll; `closes` is a date input's value. Frozen once anyone voted.
  const [opened] = useState(() =>
    initial?.poll
      ? {
          question: initial.poll.question,
          options: initial.poll.options,
          multi: initial.poll.multi,
          closes: initial.poll.closesAt ? localDate(initial.poll.closesAt) : '',
        }
      : null,
  );
  const [poll, setPoll] = useState(opened);
  const pollData = (p: typeof poll) =>
    p && {
      question: p.question,
      options: p.options.map((o) => o.trim()),
      multi: p.multi,
      // The end of the chosen day, in the author's time zone.
      closesAt: p.closes ? new Date(`${p.closes}T23:59:59`).getTime() : null,
    };
  const pollLocked = !!initial?.poll?.voters;
  const editPoll = (change: Partial<NonNullable<typeof poll>>) => setPoll((p) => p && { ...p, ...change });
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const sent = pollData(poll);
      const data = {
        title: titled ? title : '',
        body,
        language: solution ? lang : '',
        tag,
        // Sent only when added, edited or removed (null); an untouched poll is left as it is, so a
        // body edit never trips over a passed close date or a vote cast since the editor opened.
        ...(kind === 'discuss' && JSON.stringify(sent) !== JSON.stringify(pollData(opened)) && { poll: sent }),
      };
      const saved = initial
        ? await api<Detail>(`oj/posts/${initial.id}/edit`, data)
        : await api<Detail>('oj/posts', { ...data, problemId });
      onSaved(saved.post.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <form className="cs-post-editor" onSubmit={(e) => void save(e)}>
      <h3>
        {initial
          ? solution
            ? t('编辑题解', 'Edit solution')
            : t('编辑', 'Edit')
          : solution
            ? t('写题解', 'Write a solution')
            : t(...WORDS[kind].write)}
      </h3>
      <p className="cs-post-editor-note">
        {t(
          '所有人可见，显示你的公开主页名或打码后的昵称。支持 Markdown、代码块和 mermaid 图（```mermaid 代码块）；不支持图片和 HTML。',
          'Everyone can read it, under your public handle or a masked display name. Markdown, code blocks and mermaid diagrams (a ```mermaid block) work; images and HTML do not.',
        )}
      </p>
      {problemId === 'discuss:referral' && (
        <p className="cs-post-editor-note">
          {t(
            '提供内推：标上你的公司。验证过这家公司的工作邮箱、并在账号设置里打开「内推帖」展示后，帖子会带「可内推」标记，读者可以私信请求内推。',
            'Offering referrals: tag your company. Once you verify a work email there and turn on "Referral threads" in account settings, the thread shows "Gives referrals" and readers can message you for one.',
          )}
        </p>
      )}
      <div className="cs-post-editor-row">
        {titled && (
          <label>
            <span>{t('标题', 'Title')}</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} required />
          </label>
        )}
        {solution && (
          <label>
            <span>{t('语言', 'Language')}</span>
            <select value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="">{t('不限', 'Any')}</option>
              {LANGS.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
        {solution && (
          <label>
            <span>{t('技巧', 'Technique')}</span>
            <select value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">{t('不标注', 'None')}</option>
              {TECHNIQUES.map(([slug, [zh, en]]) => (
                <option key={slug} value={slug}>
                  {english ? en : zh}
                </option>
              ))}
            </select>
          </label>
        )}
        {kind === 'discuss' && (
          <label>
            <span>{t('公司', 'Company')}</span>
            <select value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">{t('不限公司', 'No company')}</option>
              {companies.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="cs-post-editor-tools">
        <fieldset className="cs-posts-sort">
          <legend className="sr-only">{t('正文视图', 'Body view')}</legend>
          <button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>
            {t('编辑', 'Write')}
          </button>
          <button type="button" aria-pressed={preview} onClick={() => setPreview(true)}>
            {t('预览', 'Preview')}
          </button>
        </fieldset>
        {!!code.trim() && !preview && (
          <button
            type="button"
            className="cs-post-act"
            onClick={() => setBody((b) => `${b.replace(/\s+$/, '')}\n\n${codeBlock(code, editorLang)}\n`)}
          >
            {t('插入我的代码', 'Insert my code')}
          </button>
        )}
      </div>
      {preview ? (
        body.trim() ? (
          <StatementMarkdown body={body} untrusted diagrams className="cs-statement-markdown cs-post-body cs-post-preview" />
        ) : (
          <p className="cs-posts-state">{t('还没有内容。', 'Nothing written yet.')}</p>
        )
      ) : (
        <textarea
          className="cs-post-input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={BODY_MAX}
          required
          aria-label={t('正文', 'Body')}
          spellCheck={false}
        />
      )}
      {kind === 'discuss' && (
        <fieldset className="cs-poll-editor" disabled={pollLocked}>
          <legend>{t('投票', 'Poll')}</legend>
          {pollLocked && (
            <p className="cs-post-editor-note">
              {t('已经有人投票，投票不能再修改。', 'People have voted, so the poll can no longer change.')}
            </p>
          )}
          {!poll ? (
            <button
              type="button"
              className="cs-post-act"
              onClick={() => setPoll({ question: '', options: ['', ''], multi: false, closes: '' })}
            >
              {t('添加投票', 'Add a poll')}
            </button>
          ) : (
            <>
              <label>
                <span>{t('问题', 'Question')}</span>
                <input
                  value={poll.question}
                  onChange={(e) => editPoll({ question: e.target.value })}
                  maxLength={200}
                  required
                />
              </label>
              {poll.options.map((option, i) => (
                <div key={i} className="cs-poll-option">
                  <input
                    value={option}
                    onChange={(e) => editPoll({ options: poll.options.map((o, j) => (j === i ? e.target.value : o)) })}
                    maxLength={POLL_OPTION_MAX}
                    required
                    aria-label={t(`选项 ${i + 1}`, `Option ${i + 1}`)}
                  />
                  {poll.options.length > 2 && (
                    <button
                      type="button"
                      className="cs-post-act"
                      aria-label={t(`删除选项 ${i + 1}`, `Remove option ${i + 1}`)}
                      onClick={() => editPoll({ options: poll.options.filter((_, j) => j !== i) })}
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
              <div className="cs-poll-tools">
                {poll.options.length < POLL_OPTIONS && (
                  <button
                    type="button"
                    className="cs-post-act"
                    onClick={() => editPoll({ options: [...poll.options, ''] })}
                  >
                    {t('添加选项', 'Add an option')}
                  </button>
                )}
                <label className="cs-poll-check">
                  <input
                    type="checkbox"
                    checked={poll.multi}
                    onChange={(e) => editPoll({ multi: e.target.checked })}
                  />
                  {t('可多选', 'Allow several choices')}
                </label>
                <label className="cs-poll-check">
                  {t('截止日期（可选）', 'Closes on (optional)')}
                  <input type="date" value={poll.closes} onChange={(e) => editPoll({ closes: e.target.value })} />
                </label>
                <button type="button" className="cs-post-act" onClick={() => setPoll(null)}>
                  {t('移除投票', 'Remove the poll')}
                </button>
              </div>
            </>
          )}
        </fieldset>
      )}
      {error && (
        <p className="cs-posts-error" role="alert">
          {error}
        </p>
      )}
      <footer className="cs-post-editor-foot">
        <span data-over={body.length > BODY_MAX || undefined}>
          {body.length} / {BODY_MAX}
        </span>
        <button type="button" onClick={onCancel}>
          {t('取消', 'Cancel')}
        </button>
        <button type="submit" className="cs-posts-write" disabled={busy || (titled && !title.trim()) || !body.trim()}>
          {busy ? t('正在发布…', 'Publishing…') : initial ? t('保存', 'Save') : t('发布', 'Publish')}
        </button>
      </footer>
    </form>
  );
}

type QueueItem = {
  kind: 'post' | 'comment' | 'gmsg' | 'dm';
  id: string;
  postId: string;
  problemId: string;
  title: string;
  excerpt: string;
  author: string;
  hidden: number;
  createdAt: number;
  reports?: number;
  reasons?: string;
};
const REASONS: Record<string, [string, string]> = {
  spam: ['广告或灌水', 'Spam'],
  offensive: ['不友善', 'Offensive'],
  wrong: ['解法有误', 'Wrong'],
  other: ['其他', 'Other'],
};

/** Where each kind's moderation actions go. */
const RESOURCES: Record<QueueItem['kind'], string> = {
  post: 'posts',
  comment: 'post-comments',
  gmsg: 'group-messages',
  dm: 'direct-messages',
};
/** What a post is, by its target, [zh, en]. */
const POST_KINDS: Record<TargetKind, [string, string]> = {
  problem: ['题解', 'Solution'],
  discuss: ['讨论帖', 'Thread'],
  q: ['回答', 'Answer'],
  exp: ['面经评论', 'Experience comment'],
  sd: ['章节讨论', 'Chapter discussion'],
};
/** Where a moderator reads a post in place: its problem, its thread page or its library item. */
function targetHref(target: string, postId: string) {
  const kind = targetKind(target);
  const key = target.slice(target.indexOf(':') + 1);
  if (kind === 'discuss') return `/?view=discuss&channel=${encodeURIComponent(key)}&post=${encodeURIComponent(postId)}`;
  if (kind === 'q' || kind === 'exp')
    return `/?${new URLSearchParams({ view: 'content', type: kind === 'q' ? 'interview_question' : 'experience', slug: key })}`;
  if (kind === 'sd') return `/system-design/${encodeURIComponent(key)}`;
  return `/?view=problem&problem=${encodeURIComponent(target)}`;
}

/** The teacher view's tab: reported posts and comments first, then the latest; hide, restore or dismiss. */
export function PostModeration() {
  const english = useLocale() === 'en';
  const t: T = (zh, en) => (english ? en : zh);
  const [data, setData] = useState<{ reported: QueueItem[]; latest: QueueItem[] } | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState('');
  useEffect(() => {
    let live = true;
    api<{ reported: QueueItem[]; latest: QueueItem[] }>('oj/posts/moderation').then(
      (d) => {
        if (!live) return;
        setData(d);
        setError('');
      },
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [reload]);
  async function act(item: QueueItem, action: 'hide' | 'unhide' | 'dismiss') {
    setBusy(`${item.kind}:${item.id}`);
    setError('');
    try {
      await api(`oj/${RESOURCES[item.kind]}/${item.id}/${action}`, {});
      setReload((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  const row = (item: QueueItem) => (
    <li key={`${item.kind}:${item.id}`} className="post-mod-item" data-hidden={item.hidden || undefined}>
      <p className="post-mod-meta">
        <span className="cs-post-lang">
          {item.kind === 'gmsg'
            ? t('小组聊天', 'Group chat')
            : item.kind === 'dm'
              ? t('私信', 'Direct message')
              : item.kind === 'comment'
                ? t('评论', 'Comment')
                : t(...POST_KINDS[targetKind(item.problemId) ?? 'problem'])}
        </span>
        {item.kind === 'gmsg' ? (
          <a href={`/?view=group&id=${encodeURIComponent(item.postId)}`}>{item.title}</a>
        ) : (
          item.kind !== 'dm' && <a href={targetHref(item.problemId, item.postId)}>{item.problemId}</a>
        )}
        <span>{item.author || t('学员', 'Learner')}</span>
        <span>{day(item.createdAt, english)}</span>
        {!!item.reports && (
          <span className="cs-post-flag">
            {t(`${item.reports} 次举报`, `${item.reports} report${item.reports > 1 ? 's' : ''}`)}
            {item.reasons &&
              ` · ${item.reasons
                .split(',')
                .map((r) => (REASONS[r] ? t(...REASONS[r]) : r))
                .join(', ')}`}
          </span>
        )}
        {item.hidden === 1 && <span>{t('作者已删除', 'Deleted by author')}</span>}
        {item.hidden === MODERATED && <span>{t('已隐藏', 'Hidden')}</span>}
      </p>
      {(item.kind === 'post' || item.kind === 'comment') && (
        <strong className="post-mod-title">
          {item.kind === 'comment' ? t(`评论于「${item.title}」`, `On “${item.title}”`) : item.title}
        </strong>
      )}
      <p className="post-mod-excerpt">{item.excerpt}</p>
      <div className="post-mod-actions">
        {item.hidden === 0 && (
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void act(item, 'hide')}>
            <EyeOff size={14} />
            {t('隐藏', 'Hide')}
          </Button>
        )}
        {item.hidden === MODERATED && (
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void act(item, 'unhide')}>
            {t('恢复显示', 'Restore')}
          </Button>
        )}
        {!!item.reports && (
          <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => void act(item, 'dismiss')}>
            {t('忽略举报', 'Dismiss reports')}
          </Button>
        )}
      </div>
    </li>
  );
  return (
    <section className="post-mod" aria-label={t('社区审核', 'Community moderation')}>
      <div className="lms-toolbar">
        <p className="muted">
          {t(
            '被举报的题解、讨论帖、回答、评论、小组聊天和私信排在前面；三人举报的会先自动隐藏。隐藏后只有作者自己能看到（聊天和私信对双方都隐藏），可以随时恢复。私信只有被举报的那一条会出现在这里。',
            'Reported solutions, threads, answers, comments, group chat and direct messages come first; three reports hide one until you act. Hidden items stay visible to their author only (chat and direct messages to nobody), and can be restored. Only the reported direct message shows here, never the rest.',
          )}
        </p>
        <Button variant="outline" onClick={() => setReload((n) => n + 1)}>
          <RefreshCw size={15} />
          {t('刷新', 'Refresh')}
        </Button>
      </div>
      {error && (
        <p className="cs-posts-error" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        !error && <output className="cs-posts-state">{t('正在加载…', 'Loading…')}</output>
      ) : (
        <>
          <h3 className="post-mod-heading">
            {t('被举报', 'Reported')} <span>{data.reported.length}</span>
          </h3>
          {data.reported.length ? (
            <ul className="post-mod-list">{data.reported.map(row)}</ul>
          ) : (
            <p className="cs-posts-state">{t('没有待处理的举报。', 'No open reports.')}</p>
          )}
          <h3 className="post-mod-heading">{t('最新发布', 'Latest')}</h3>
          {data.latest.length ? (
            <ul className="post-mod-list">{data.latest.map(row)}</ul>
          ) : (
            <p className="cs-posts-state">{t('还没有题解或评论。', 'No solutions or comments yet.')}</p>
          )}
        </>
      )}
    </section>
  );
}
