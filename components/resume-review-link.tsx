'use client';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { Copy, MessageSquareText } from 'lucide-react';
import { useLocale, useT } from '@/lib/i18n';
import { ojRequest } from '@/lib/oj-client';
import { applyRewrite, lineAt, lines, normalizeResume, reviewSnapshot, type ListKey, type Resume } from '@/lib/resume-shape';

/**
 * Private resume review links (lib/server/resume-reviews.ts): ResumeReviewLink sits under the
 * builder's tools and snapshots the resume being edited; ResumeReviewPage is
 * /career/resume/review/<token|id>, the snapshot line by line, where a reader comments on a line
 * and may suggest a rewrite, and the owner writes an accepted rewrite back into this browser's
 * copy. Comments are plain text, never HTML. Styles: app/code-review.css and app/resume-review-link.css,
 * loaded by the two pages (so tests importing the builder need no CSS loader).
 */
// The builder's storage keys (components/resume-builder.tsx), written here literally so this page
// does not load the builder; tests/resume-review-link-ui.test.mjs checks they match.
export const RESUME_KEY = 'cswork:resume:v1';
export const RESUME_VERSIONS_KEY = 'cswork:resume:versions';

type Comment = {
  id: string;
  path: string;
  original: string;
  body: string;
  suggestion: string;
  acceptedAt: number | null;
  createdAt: number;
  reviewer: number;
  handle: string | null;
  mine: boolean;
};
type Review = {
  id: string | null;
  mine: boolean;
  version: string | null;
  snapshot: Resume;
  note: string;
  author: string | null;
  createdAt: number;
  comments: Comment[];
};
type OpenLink = { id: string; note: string; version: string; createdAt: number; comments: number; pending: number };
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const SECTIONS: [ListKey, string, string][] = [
  ['education', '教育经历', 'Education'],
  ['experience', '工作经历', 'Experience'],
  ['projects', '项目', 'Projects'],
];

/** "Ask someone to review it" under the builder's tools: makes a link to the resume being edited and lists the open ones. */
export function ResumeReviewLink({ resume, version }: { resume: Resume; version: string }) {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<OpenLink[] | null>(null);
  const [note, setNote] = useState('');
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () =>
    ojRequest<{ items: OpenLink[] }>('resume-reviews').then(
      (r) => setLinks(r.items),
      (error) => setStatus(message(error)),
    );
  useEffect(() => {
    if (open && links === null) void load();
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once, the first time it opens.
  }, [open]);
  const copy = (link: string) =>
    (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject(new Error('no clipboard')))
      .then(() => setStatus(t('链接已复制。', 'Link copied.')))
      .catch(() => setStatus(t('没能自动复制，请手动复制上面的链接。', "Couldn't copy it. Copy the link above by hand.")));
  async function create() {
    setBusy(true);
    setStatus('');
    try {
      // The server drops these too; they never need to leave the browser.
      const snapshot = reviewSnapshot(resume);
      const { token } = await ojRequest<{ id: string; token: string }>('resume-reviews', { resume: snapshot, version, note });
      const link = `${location.origin}/career/resume/review/${token}`;
      setUrl(link);
      setNote('');
      await copy(link);
      void load();
    } catch (error) {
      setStatus(message(error));
    } finally {
      setBusy(false);
    }
  }
  async function close(id: string) {
    if (!window.confirm(t('关闭后，拿到这条链接的人就打不开了，简历快照也会删掉。确定关闭？', 'Once closed, nobody can open this link and its resume snapshot is deleted. Close it?')))
      return;
    try {
      await ojRequest(`resume-reviews/${id}/close`, {});
      setLinks((items) => items?.filter((item) => item.id !== id) ?? null);
    } catch (error) {
      setStatus(message(error));
    }
  }
  return (
    <details className="cr-ask rr-ask" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <MessageSquareText size={15} aria-hidden="true" />
        {t('请人看简历', 'Ask someone to review it')}
      </summary>
      <p>
        {t(
          '把正在编辑的这份简历存一份快照，生成私密链接发给朋友或学长。拿到链接并登录的人能看到快照（不含姓名和联系方式），逐条批注，也可以给改写建议；你接受的建议会写回这个浏览器里的简历。之后再改简历，快照不会跟着变。',
          'Saves a snapshot of the resume you are editing and makes a private link to send to a friend or mentor. Anyone signed in who has it sees the snapshot (without your name or contact lines), comments line by line and may suggest rewrites; rewrites you accept go back into the resume in this browser. Later edits do not change the snapshot.',
        )}
      </p>
      <textarea
        aria-label={t('给评审人的留言（可选）', 'Note to reviewers (optional)')}
        placeholder={t('投什么岗位？想让对方重点看什么？（可选）', 'What roles is it for? What should they look at? (optional)')}
        maxLength={500}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <button type="button" className="cr-primary" disabled={busy} onClick={() => void create()}>
        {busy ? t('正在生成…', 'Making the link…') : version ? t(`为「${version}」生成链接`, `Make a link to “${version}”`) : t('生成评审链接', 'Make a review link')}
      </button>
      {url && (
        <div className="cr-made">
          <input readOnly value={url} aria-label={t('评审链接', 'Review link')} onFocus={(event) => event.currentTarget.select()} />
          <button type="button" onClick={() => void copy(url)} aria-label={t('复制链接', 'Copy link')}>
            <Copy size={14} aria-hidden="true" />
            {t('复制', 'Copy')}
          </button>
          <small>{t('这条链接只显示这一次，请现在保存。', 'This link is shown only once. Save it now.')}</small>
        </div>
      )}
      <output>{status}</output>
      {!!links?.length && (
        <ul className="cr-links" aria-label={t('你未关闭的简历评审链接', 'Your open resume review links')}>
          {links.map((item) => (
            <li key={item.id}>
              <span>
                {new Date(item.createdAt).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en')} · {item.version || t('基础版', 'Base resume')} ·{' '}
                {t(`${item.comments} 条批注`, `${item.comments} comment${item.comments === 1 ? '' : 's'}`)}
                {item.pending > 0 && ` · ${t(`${item.pending} 条建议待处理`, `${item.pending} rewrite${item.pending === 1 ? '' : 's'} to review`)}`}
                {item.note && ` · ${item.note.slice(0, 40)}`}
              </span>
              <span className="rr-link-actions">
                <a
                  href={`/career/resume/review/${item.id}`}
                  target="_blank"
                  rel="noreferrer"
                  title={t('这个地址只有你能打开；请人评审要发生成时保存的链接', 'Only you can open this address. Send reviewers the link you saved when you made it')}
                >
                  {t('打开', 'Open')}
                </a>
                <button type="button" onClick={() => void close(item.id)}>
                  {t('关闭', 'Close')}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

/** A stored object, or null for anything else (a damaged or missing entry). */
function stored(key: string): Record<string, unknown> | null {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** /career/resume/review/<token|id>: the snapshot, section by section, with comments under their lines. */
export function ResumeReviewPage({ token }: { token: string }) {
  const t = useT();
  const locale = useLocale();
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState('');
  const [closed, setClosed] = useState(false);
  const [path, setPath] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [rewrite, setRewrite] = useState('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');
  // The comment whose rewrite could not be written back, and what happened on the last accept.
  const [stale, setStale] = useState('');
  const [status, setStatus] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (path !== null) field.current?.focus();
  }, [path]);
  // Once the review is on screen a failed reload or close shows above it instead of replacing it.
  const load = () =>
    ojRequest<Review>(`resume-reviews/${encodeURIComponent(token)}`).then(
      (next) => {
        setReview(next);
        setError('');
      },
      (failure) => setError(message(failure)),
    );
  useEffect(() => {
    void load();
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- per token.
  }, [token]);
  if (closed) return <p className="cr-state">{t('评审链接已关闭。', 'The review link is closed.')}</p>;
  if (!review)
    return error ? (
      <p className="cr-state" role="alert">
        {error}
      </p>
    ) : (
      <p className="cr-state">{t('正在加载简历…', 'Loading the resume…')}</p>
    );
  const r = review.snapshot;
  const who = (c: Comment) =>
    (c.handle ? `@${c.handle}` : c.reviewer === 0 ? t('简历作者', 'Owner') : t(`评审者 ${c.reviewer}`, `Reviewer ${c.reviewer}`)) +
    (c.mine ? t('（你）', ' (you)') : '');
  async function send(event: SubmitEvent) {
    event.preventDefault();
    if (path === null) return;
    setSending(true);
    setFormError('');
    try {
      await ojRequest(`resume-reviews/${encodeURIComponent(token)}/comments`, { path, body: draft, suggestion: rewrite });
      setDraft('');
      setRewrite('');
      setPath(null);
      await load();
    } catch (failure) {
      setFormError(message(failure));
    } finally {
      setSending(false);
    }
  }
  // Server first, browser second: a rewrite is never in the resume without being marked taken.
  async function accept(c: Comment) {
    setStale('');
    setStatus('');
    const version = review!.version ?? '';
    const versions = version ? stored(RESUME_VERSIONS_KEY) : null;
    const current = version ? versions?.[version] : stored(RESUME_KEY);
    const next = current ? applyRewrite(normalizeResume(current), c.path, c.original, c.suggestion) : null;
    if (!next) return setStale(c.id);
    try {
      await ojRequest(`resume-reviews/${encodeURIComponent(token)}/accept`, { commentId: c.id });
    } catch (failure) {
      return setError(message(failure));
    }
    try {
      if (version) localStorage.setItem(RESUME_VERSIONS_KEY, JSON.stringify({ ...versions, [version]: next }));
      else localStorage.setItem(RESUME_KEY, JSON.stringify(next));
      setStatus(t('已写回简历生成器，开着的生成器标签页会自动更新。', 'Written back to the resume builder; a builder tab left open picks it up.'));
    } catch {
      setStatus(t('这台浏览器不让写入本地存储：请复制建议，手动改。', 'This browser blocks local storage: copy the rewrite and edit it by hand.'));
    }
    await load();
  }
  const copy = (text: string) =>
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject(new Error('no clipboard')))
      .then(() => setStatus(t('建议已复制。', 'Rewrite copied.')))
      .catch(() => setStatus(t('没能自动复制，请手动选中建议复制。', "Couldn't copy it. Select the rewrite and copy it by hand.")));
  async function closeLink() {
    if (!window.confirm(t('关闭后，拿到这条链接的人就打不开了，简历快照也会删掉。确定关闭？', 'Once closed, nobody can open this link and its resume snapshot is deleted. Close it?')))
      return;
    try {
      await ojRequest(`resume-reviews/${encodeURIComponent(token)}/close`, {});
      setClosed(true);
    } catch (failure) {
      setError(message(failure));
    }
  }
  /** One commentable line: its text, its comments, and the form when it is the one being commented on. */
  const line = (where: string, label: string) => {
    const text = lineAt(r, where)!;
    const here = review.comments.filter((c) => c.path === where);
    return (
      <li key={where}>
        <div className="rr-line">
          <p>{text}</p>
          <button
            type="button"
            aria-expanded={path === where}
            aria-label={t(`批注：${label}`, `Comment on ${label}`)}
            onClick={() => {
              setPath(path === where ? null : where);
              setFormError('');
            }}
          >
            {t('批注', 'Comment')}
          </button>
        </div>
        {here.map((c) => (
          <div className="cr-comment" key={c.id}>
            <strong>{who(c)}</strong>
            <p>{c.body}</p>
            {c.suggestion && (
              <p className="rr-rewrite">
                <span className="rr-tag">{t('改写为', 'Rewrite')}</span> <del>{c.original}</del> <ins>{c.suggestion}</ins>
              </p>
            )}
            {review.mine &&
              c.suggestion &&
              (c.acceptedAt ? (
                <small className="rr-done">{t('已接受', 'Accepted')}</small>
              ) : (
                <button type="button" onClick={() => void accept(c)}>
                  {t('接受并写回', 'Accept and write back')}
                </button>
              ))}
            {stale === c.id && (
              <p className="rr-stale" role="alert">
                {t('原句已改过、改完会超出字数上限，或这台浏览器里没有这份简历。', 'The line was edited since, the rewrite would go over the length limit, or this browser does not have this resume.')}{' '}
                <button type="button" onClick={() => void copy(c.suggestion)}>
                  {t('复制建议', 'Copy the rewrite')}
                </button>
              </p>
            )}
          </div>
        ))}
        {path === where && (
          <form className="cr-form rr-form" onSubmit={(event) => void send(event)}>
            <textarea
              ref={field}
              required
              maxLength={2000}
              aria-label={t(`对「${label}」的批注`, `Comment on ${label}`)}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <label>
              {t('改写为（可选，一行）', 'Rewrite as (optional, one line)')}
              <input maxLength={500} value={rewrite} onChange={(event) => setRewrite(event.target.value)} />
            </label>
            <div>
              <button type="submit" className="cr-primary" disabled={sending || !draft.trim()}>
                {sending ? t('正在发送…', 'Sending…') : t('发表批注', 'Comment')}
              </button>
              <button type="button" onClick={() => setPath(null)}>
                {t('取消', 'Cancel')}
              </button>
              <small role="alert">{formError}</small>
            </div>
          </form>
        )}
      </li>
    );
  };
  const textLines = (key: 'skills' | 'awards', zh: string, en: string) =>
    lines(r[key]).length > 0 && (
      <section className="rr-section">
        <h2>{t(zh, en)}</h2>
        <ol className="rr-lines">{lines(r[key]).map((_, i) => line(`${key}.${i}`, t(`${zh}第 ${i + 1} 行`, `${en.toLowerCase()} line ${i + 1}`)))}</ol>
      </section>
    );
  return (
    <article className="cr-review rr-review">
      <header>
        <p className="cr-kicker">{t('简历评审 · 私密链接', 'Resume review · private link')}</p>
        <h1>{review.mine ? t('你的简历', 'Your resume') : review.author ? t(`@${review.author} 的简历`, `@${review.author}’s resume`) : t('一份简历', 'A resume')}</h1>
        <p className="cr-meta">
          {review.mine && `${review.version || t('基础版', 'Base resume')} · `}
          {new Date(review.createdAt).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en')} ·{' '}
          {t(`${review.comments.length} 条批注`, `${review.comments.length} comment${review.comments.length === 1 ? '' : 's'}`)}
        </p>
        {review.note && <p className="cr-note">{review.note}</p>}
        <p className="cr-hint">
          {t('这是生成链接时的快照，不含姓名和联系方式。点一条后面的「批注」留言，可以顺便写一句改写建议。', 'A snapshot from when the link was made, without the name or contact lines. Press Comment after a line to leave a note, with a rewrite if you like.')}
          {review.mine && (
            <button type="button" onClick={() => void closeLink()}>
              {t('关闭这条链接', 'Close this link')}
            </button>
          )}
        </p>
        {!review.mine && (
          <p className="cr-hint">
            {t('发批注需要验证过邮箱的账号，用 Google 或 GitHub 登录的账号就可以。', 'Commenting needs an account with a verified email; one signed in with Google or GitHub has it.')}
          </p>
        )}
        {review.mine && token === review.id && (
          <p className="cr-hint">
            {t(
              '这个地址只有你能打开。请人评审要发生成时保存的链接；链接丢了就在简历生成器里新建一条。',
              "Only you can open this address. To ask for a review, send the link you saved when you made it; if it's lost, make a new one in the resume builder.",
            )}
          </p>
        )}
        {error && (
          <p className="cr-hint" role="alert">
            {error}
          </p>
        )}
        {status && <output className="cr-hint">{status}</output>}
      </header>
      {SECTIONS.map(([key, zh, en]) => {
        const items = r[key].map((item, index) => ({ item, index })).filter(({ item }) => item.title.trim() || lines(item.bullets).length);
        return (
          items.length > 0 && (
            <section className="rr-section" key={key}>
              <h2>{t(zh, en)}</h2>
              {items.map(({ item, index }) => (
                <div className="rr-entry" key={index}>
                  <p className="rr-entry-head">
                    <strong>{item.title}</strong>
                    {[item.subtitle, item.dates].filter((s) => s.trim()).map((s) => ` · ${s}`)}
                  </p>
                  {lines(item.bullets).length > 0 && (
                    <ol className="rr-lines">
                      {lines(item.bullets).map((_, i) =>
                        line(`${key}.${index}.bullets.${i}`, t(`${item.title || zh}第 ${i + 1} 条`, `${item.title || en} bullet ${i + 1}`)),
                      )}
                    </ol>
                  )}
                </div>
              ))}
            </section>
          )
        );
      })}
      {textLines('skills', '技能', 'Skills')}
      {textLines('awards', '奖项与证书', 'Awards')}
    </article>
  );
}
