'use client';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowLeft,
  EyeOff,
  Flag,
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
import { StatementMarkdown } from './statement-markdown';
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
  hidden: number;
  createdAt: number;
  updatedAt: number;
  author: string;
  mine: boolean;
  votes: number;
  voted: boolean;
  comments: number;
  excerpt?: string;
};
type Comment = { id: string; body: string; createdAt: number; author: string; mine: boolean };
type Detail = { post: PostSummary & { body: string }; comments: Comment[] };
type Page = { solved: boolean; items: PostSummary[]; more: boolean };
type Confirm = { title: string; description: string; action: string; run: () => void };

// Same caps as lib/server/solution-posts.ts; the server is the one that enforces them.
const TITLE_MAX = 120;
const BODY_MAX = 20000;
const COMMENT_MAX = 1000;
// hidden: 2 is a moderator's hide (an author's own removal never comes back from the server).
const MODERATED = 2;
const LANGS: [string, string][] = [
  ['python', 'Python'],
  ['cpp', 'C++'],
  ['java', 'Java'],
  ['go', 'Go'],
];
const langName = (id: string) => LANGS.find(([key]) => key === id)?.[1] ?? '';
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
 * Community solutions for one problem: locked until the learner has an AC (or confirms
 * they want to look), then a list by votes or date, one post with its comments, and an
 * editor. `code`/`language` are the workspace editor's, offered as the new post's code.
 */
export function SolutionPosts({
  problemId,
  english,
  code = '',
  language = '',
  only = '',
}: {
  problemId: string;
  english: boolean;
  code?: string;
  language?: string;
  /** Opened from the AC dialog's histogram: that language's posts first; the chip clears it. */
  only?: string;
}) {
  const t: T = (zh, en) => (english ? en : zh);
  const [sort, setSort] = useState<'votes' | 'new'>('votes');
  const [filter, setFilter] = useState(() => (langName(only) ? only : ''));
  const query = `oj/posts?problem=${encodeURIComponent(problemId)}&sort=${sort}${filter ? `&language=${filter}` : ''}`;
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [peek, setPeek] = useState(() => readPeek(problemId));
  const [view, setView] = useState<
    { kind: 'list' } | { kind: 'post'; id: string } | { kind: 'edit'; post: Detail['post'] | null }
  >({ kind: 'list' });
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
      const next = await api<Page>(`${query}&offset=${page.items.length}`);
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
      />
    );
  else if (view.kind === 'edit')
    body = (
      <PostEditor
        problemId={problemId}
        english={english}
        initial={view.post}
        code={code}
        language={language}
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
      <output className="cs-posts-state">{t('正在加载题解…', 'Loading solutions…')}</output>
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
          <fieldset className="cs-posts-sort">
            <legend className="sr-only">{t('排序', 'Sort by')}</legend>
            <button type="button" aria-pressed={sort === 'votes'} onClick={() => setSort('votes')}>
              {t('最热', 'Most votes')}
            </button>
            <button type="button" aria-pressed={sort === 'new'} onClick={() => setSort('new')}>
              {t('最新', 'Newest')}
            </button>
          </fieldset>
          {filter && (
            <button
              type="button"
              className="cs-posts-filter"
              aria-label={t(`清除筛选：只看 ${langName(filter)}`, `Clear filter: ${langName(filter)} only`)}
              onClick={() => setFilter('')}
            >
              {t(`只看 ${langName(filter)}`, `${langName(filter)} only`)}
              <X size={12} aria-hidden="true" />
            </button>
          )}
          <button type="button" className="cs-posts-write" onClick={() => setView({ kind: 'edit', post: null })}>
            <Pencil size={14} aria-hidden="true" />
            {t('写题解', 'Write a solution')}
          </button>
        </header>
        {error && (
          <p className="cs-posts-error" role="alert">
            {error}
          </p>
        )}
        {page.items.length ? (
          <ul className="cs-posts-list">
            {page.items.map((post) => (
              <li key={post.id}>
                <button type="button" className="cs-post-row" onClick={() => setView({ kind: 'post', id: post.id })}>
                  <span className="cs-post-row-title">{post.title}</span>
                  {post.excerpt && <span className="cs-post-row-excerpt">{plainExcerpt(post.excerpt)}</span>}
                  <span className="cs-post-row-meta">
                    <span>{post.author || t('学员', 'Learner')}</span>
                    <span>{day(post.createdAt, english)}</span>
                    {post.language && <span className="cs-post-lang">{langName(post.language)}</span>}
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
            ))}
          </ul>
        ) : (
          <p className="cs-posts-state">
            {t('还没有题解，来写第一篇吧。', 'No solutions yet. Be the first to share one.')}
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
    <section className="cs-posts" aria-label={t('社区题解', 'Community solutions')}>
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
}: {
  id: string;
  english: boolean;
  onBack: () => void;
  onEdit: (post: Detail['post']) => void;
  ask: (confirm: Confirm) => void;
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
      {t('全部题解', 'All solutions')}
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
  async function vote() {
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
      <h3 className="cs-post-title">{post.title}</h3>
      <p className="cs-post-meta">
        <span>{post.author || t('学员', 'Learner')}</span>
        <span>{day(post.createdAt, english)}</span>
        {post.updatedAt > post.createdAt + 60000 && <span>{t('已编辑', 'edited')}</span>}
        {post.language && <span className="cs-post-lang">{langName(post.language)}</span>}
      </p>
      <StatementMarkdown body={post.body} untrusted className="cs-statement-markdown cs-post-body" />
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
          <Report path={`oj/posts/${post.id}/report`} english={english} />
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
                    <Report path={`oj/post-comments/${c.id}/report`} english={english} />
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

/** Report with a reason; one per learner, read by instructors in the teacher view. */
function Report({ path, english }: { path: string; english: boolean }) {
  const t: T = (zh, en) => (english ? en : zh);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('spam');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  if (done)
    return (
      <span className="cs-post-reported" role="status">
        {t('已举报，谢谢', 'Reported. Thanks')}
      </span>
    );
  if (!open)
    return (
      <button type="button" className="cs-post-act" onClick={() => setOpen(true)}>
        <Flag size={13} aria-hidden="true" />
        {t('举报', 'Report')}
      </button>
    );
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await api(path, { reason });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <form className="cs-post-report" onSubmit={(e) => void submit(e)}>
      <select value={reason} onChange={(e) => setReason(e.target.value)} aria-label={t('举报理由', 'Reason')}>
        <option value="spam">{t('广告或灌水', 'Spam')}</option>
        <option value="offensive">{t('不友善或冒犯', 'Offensive')}</option>
        <option value="wrong">{t('解法有误', 'Wrong solution')}</option>
        <option value="other">{t('其他', 'Other')}</option>
      </select>
      <button type="submit">{t('提交', 'Send')}</button>
      <button type="button" onClick={() => setOpen(false)}>
        {t('取消', 'Cancel')}
      </button>
      {error && (
        <span className="cs-posts-error" role="alert">
          {error}
        </span>
      )}
    </form>
  );
}

function PostEditor({
  problemId,
  english,
  initial,
  code,
  language,
  onCancel,
  onSaved,
}: {
  problemId: string;
  english: boolean;
  initial: Detail['post'] | null;
  code: string;
  language: string;
  onCancel: () => void;
  onSaved: (id: string) => void;
}) {
  const t: T = (zh, en) => (english ? en : zh);
  const editorLang = langName(language) ? language : '';
  const [title, setTitle] = useState(initial?.title ?? '');
  const [lang, setLang] = useState(initial ? initial.language : editorLang);
  // A new post starts from a short outline with the editor's code already in it.
  const [body, setBody] = useState(
    () =>
      initial?.body ??
      [
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
      ].join('\n'),
  );
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = { title, body, language: lang };
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
      <h3>{initial ? t('编辑题解', 'Edit solution') : t('写题解', 'Write a solution')}</h3>
      <p className="cs-post-editor-note">
        {t(
          '所有人可见，显示你的昵称。支持 Markdown 和代码块；不支持图片和 HTML。',
          'Everyone can read it, under your display name. Markdown and code blocks work; images and HTML do not.',
        )}
      </p>
      <div className="cs-post-editor-row">
        <label>
          <span>{t('标题', 'Title')}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} required />
        </label>
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
          <StatementMarkdown body={body} untrusted className="cs-statement-markdown cs-post-body cs-post-preview" />
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
        <button type="submit" className="cs-posts-write" disabled={busy || !title.trim() || !body.trim()}>
          {busy ? t('正在发布…', 'Publishing…') : initial ? t('保存', 'Save') : t('发布', 'Publish')}
        </button>
      </footer>
    </form>
  );
}

type QueueItem = {
  kind: 'post' | 'comment';
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
      await api(`oj/${item.kind === 'post' ? 'posts' : 'post-comments'}/${item.id}/${action}`, {});
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
        <span className="cs-post-lang">{item.kind === 'post' ? t('题解', 'Solution') : t('评论', 'Comment')}</span>
        <a href={`/?view=problem&problem=${encodeURIComponent(item.problemId)}`}>{item.problemId}</a>
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
      <strong className="post-mod-title">
        {item.kind === 'comment' ? t(`评论于「${item.title}」`, `On “${item.title}”`) : item.title}
      </strong>
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
    <section className="post-mod" aria-label={t('题解审核', 'Solution moderation')}>
      <div className="lms-toolbar">
        <p className="muted">
          {t(
            '被举报的题解和评论排在前面。隐藏后只有作者自己能看到，可以随时恢复。',
            'Reported solutions and comments come first. Hidden items stay visible to their author only, and can be restored.',
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
