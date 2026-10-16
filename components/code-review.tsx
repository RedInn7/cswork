'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Copy, MessageSquareCode } from 'lucide-react';
import '@/app/code-review.css';
import { useLocale, useT } from '@/lib/i18n';
import { ojRequest, verdict } from '@/lib/oj-client';
import { languages } from '@/lib/problems';

/**
 * Private code review links (lib/server/code-reviews.ts): ReviewLink opens one from an accepted
 * submission's detail dialog; CodeReview is /review/<token|id>, the read-only code where a click
 * on a line number leaves a comment under that line. Comment bodies are plain text, never HTML.
 */
type Comment = { id: string; line: number; body: string; createdAt: number; reviewer: number; handle: string | null; mine: boolean };
type Review = {
  id: string | null;
  mine: boolean;
  problem: { id: string; title: string; titleEn: string | null };
  language: string;
  code: string;
  status: string;
  note: string;
  author: string | null;
  createdAt: number;
  comments: Comment[];
};
type OpenLink = { id: string; note: string; createdAt: number; comments: number };
const COMMENT_MAX = 2000;
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** "Ask for a review" under an accepted submission: makes the link, copies it, lists the open ones. */
export function ReviewLink({ submissionId }: { submissionId: string }) {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<OpenLink[] | null>(null);
  const [note, setNote] = useState('');
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () =>
    ojRequest<{ items: OpenLink[] }>(`reviews?submission=${encodeURIComponent(submissionId)}`).then(
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
      const { token } = await ojRequest<{ id: string; token: string }>('reviews', { submissionId, note });
      const link = `${location.origin}/review/${token}`;
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
    if (!window.confirm(t('关闭后，拿到这条链接的人就打不开了，已有评论也看不到了。确定关闭？', 'Once closed, nobody can open this link and its comments are gone from view. Close it?')))
      return;
    try {
      await ojRequest(`reviews/${id}/close`, {});
      setLinks((items) => items?.filter((item) => item.id !== id) ?? null);
    } catch (error) {
      setStatus(message(error));
    }
  }
  return (
    <details className="cs-submission-note cr-ask" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <MessageSquareCode size={14} aria-hidden="true" />
        {t('请人评审', 'Ask for a code review')}
      </summary>
      <p>
        {t(
          '生成一条私密链接发给别人。拿到链接的登录用户都能看到这份代码并逐行评论，但看不到你的姓名和邮箱。',
          'Make a private link to send to someone. Anyone signed in who has it can read this code and comment on its lines, but not see your name or email.',
        )}
      </p>
      <textarea
        aria-label={t('给评审人的留言（可选）', 'Note to reviewers (optional)')}
        placeholder={t('想让评审人重点看什么？（可选）', 'What should reviewers look at? (optional)')}
        maxLength={500}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <button type="button" className="cr-primary" disabled={busy} onClick={() => void create()}>
        {busy ? t('正在生成…', 'Making the link…') : t('生成评审链接', 'Make a review link')}
      </button>
      {url && (
        <div className="cr-made">
          <input readOnly value={url} aria-label={t('评审链接', 'Review link')} onFocus={(event) => event.currentTarget.select()} />
          <button type="button" onClick={() => void copy(url)} aria-label={t('复制链接', 'Copy link')}>
            <Copy size={14} aria-hidden="true" />
          </button>
          <small>{t('这条链接只显示这一次，请现在保存。', 'This link is shown only once. Save it now.')}</small>
        </div>
      )}
      <output>{status}</output>
      {!!links?.length && (
        <ul className="cr-links" aria-label={t('这次提交未关闭的评审链接', 'Open review links on this submission')}>
          {links.map((item) => (
            <li key={item.id}>
              <a href={`/review/${item.id}`} target="_blank" rel="noreferrer">
                {new Date(item.createdAt).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en')} ·{' '}
                {t(`${item.comments} 条评论`, `${item.comments} comment${item.comments === 1 ? '' : 's'}`)}
              </a>
              <button type="button" onClick={() => void close(item.id)}>
                {t('关闭', 'Close')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

/** /review/<token|id>: the code, read only, with comments under their lines. */
export function CodeReview({ token }: { token: string }) {
  const t = useT();
  const locale = useLocale();
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState('');
  const [closed, setClosed] = useState(false);
  const [line, setLine] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  // The form opened by a line number takes focus.
  useEffect(() => {
    if (line !== null) field.current?.focus();
  }, [line]);
  const load = () =>
    ojRequest<Review>(`reviews/${encodeURIComponent(token)}`).then(setReview, (failure) => setError(message(failure)));
  useEffect(() => {
    void load();
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- per token.
  }, [token]);
  if (closed) return <p className="cr-state">{t('评审链接已关闭。', 'The review link is closed.')}</p>;
  if (error)
    return (
      <p className="cr-state" role="alert">
        {error}
      </p>
    );
  if (!review) return <p className="cr-state">{t('正在加载代码…', 'Loading the code…')}</p>;
  const who = (c: { reviewer: number; handle: string | null; mine: boolean }) =>
    (c.handle ? `@${c.handle}` : c.reviewer === 0 ? t('作者', 'Author') : t(`评审者 ${c.reviewer}`, `Reviewer ${c.reviewer}`)) +
    (c.mine ? t('（你）', ' (you)') : '');
  const lines = review.code.split('\n');
  const title = (locale === 'en' && review.problem.titleEn) || review.problem.title;
  const [zh, en] = verdict(review.status);
  async function send(event: FormEvent) {
    event.preventDefault();
    if (line === null) return;
    setSending(true);
    setFormError('');
    try {
      await ojRequest(`reviews/${encodeURIComponent(token)}/comments`, { line, body: draft });
      setDraft('');
      setLine(null);
      await load();
    } catch (failure) {
      setFormError(message(failure));
    } finally {
      setSending(false);
    }
  }
  async function closeLink() {
    if (!window.confirm(t('关闭后，拿到这条链接的人就打不开了。确定关闭？', 'Once closed, nobody can open this link. Close it?'))) return;
    try {
      await ojRequest(`reviews/${encodeURIComponent(token)}/close`, {});
      setClosed(true);
    } catch (failure) {
      setError(message(failure));
    }
  }
  return (
    <article className="cr-review">
      <header>
        <p className="cr-kicker">{t('代码评审 · 私密链接', 'Code review · private link')}</p>
        <h1>
          <a href={`/?view=problem&problem=${encodeURIComponent(review.problem.id)}`}>{title}</a>
        </h1>
        <p className="cr-meta">
          {languages.find((item) => item.id === review.language)?.name ?? review.language} · {t(zh, en)} ·{' '}
          {review.author ? `@${review.author}` : t('作者', 'Author')} ·{' '}
          {new Date(review.createdAt).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en')}
        </p>
        {review.note && <p className="cr-note">{review.note}</p>}
        <p className="cr-hint">
          {t('点行号，在那一行下面留评论。', 'Click a line number to comment under that line.')}
          {review.mine && (
            <button type="button" onClick={() => void closeLink()}>
              {t('关闭这条链接', 'Close this link')}
            </button>
          )}
        </p>
      </header>
      <ol className="cr-code" aria-label={t('代码', 'Code')}>
        {lines.map((text, index) => {
          const n = index + 1;
          const here = review.comments.filter((c) => c.line === n);
          return (
            <li key={n}>
              <div className="cr-line">
                <button
                  type="button"
                  className="cr-num"
                  aria-expanded={line === n}
                  aria-label={t(`在第 ${n} 行评论`, `Comment on line ${n}`)}
                  onClick={() => {
                    setLine(line === n ? null : n);
                    setFormError('');
                  }}
                >
                  {n}
                </button>
                <code>{text || ' '}</code>
              </div>
              {here.map((c) => (
                <div className="cr-comment" key={c.id}>
                  <strong>{who(c)}</strong>
                  <p>{c.body}</p>
                </div>
              ))}
              {line === n && (
                <form className="cr-form" onSubmit={(event) => void send(event)}>
                  <textarea
                    ref={field}
                    required
                    maxLength={COMMENT_MAX}
                    aria-label={t(`第 ${n} 行的评论`, `Comment on line ${n}`)}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                  <div>
                    <button type="submit" className="cr-primary" disabled={sending || !draft.trim()}>
                      {sending ? t('正在发送…', 'Sending…') : t('发表评论', 'Comment')}
                    </button>
                    <button type="button" onClick={() => setLine(null)}>
                      {t('取消', 'Cancel')}
                    </button>
                    <small role="alert">{formError}</small>
                  </div>
                </form>
              )}
            </li>
          );
        })}
      </ol>
    </article>
  );
}
