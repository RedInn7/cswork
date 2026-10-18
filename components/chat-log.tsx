'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Flag, Send } from 'lucide-react';
import { api, ApiError } from '@/lib/types';
import '@/app/chat.css';

/** One line of a study group chat. */
export type ChatItem = { id: string; body: string; createdAt: number; mine: boolean; name?: string | null };
/** How often an open chat asks for new lines. */
export const POLL_MS = 10000;
const MAX = 2000;

/**
 * A chat from `path` (oj/groups/<id>/messages): loaded, then reloaded whole every
 * 10 s while the tab is visible, so lines taken back or moderated leave open chats too. `fresh`
 * is how many lines from others the last answer brought (a poll's or a send's), for one polite
 * screen reader sentence instead of reading every line; `seq` makes the same count say it again.
 * `show(next)` puts in a server answer (after sending or taking a line back). A 403 stops the
 * polls (`forbidden`): the reader may not see this chat (any more).
 */
export function useChat<T extends { items: ChatItem[] }>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [fresh, setFresh] = useState({ n: 0, seq: 0 });
  const [forbidden, setForbidden] = useState(false);
  const latest = useRef<T | null>(null);
  const shown = useRef(0);
  const show = useCallback((next: T) => {
    const old = latest.current;
    const seq = ++shown.current;
    latest.current = next;
    setData(next);
    setFresh({ n: old ? next.items.filter((n) => !n.mine && !old.items.some((o) => o.id === n.id)).length : 0, seq });
  }, []);
  useEffect(() => {
    let live = true;
    latest.current = null;
    setForbidden(false);
    const load = () => {
      const asked = shown.current;
      api<T>(path).then(
        (next) => {
          // A send or take-back answered while this poll was out: its answer is newer.
          if (!live || asked !== shown.current) return;
          setError('');
          show(next);
        },
        (e: Error) => {
          if (!live) return;
          setError(e.message);
          if (e instanceof ApiError && e.status === 403) {
            setForbidden(true);
            clearInterval(timer);
          }
        },
      );
    };
    load();
    const timer = setInterval(() => !document.hidden && load(), POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [path, show]);
  return { data, error, fresh, forbidden, show, setError };
}

const when = (time: number, english: boolean) =>
  new Date(time).toLocaleString(english ? 'en-US' : 'zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * The lines, oldest first, kept scrolled to the newest unless the reader scrolled up. `named`
 * shows each author (group chat); `actions` renders a line's take-back or report.
 */
export function ChatLog({
  items,
  label,
  english,
  named = false,
  fresh = { n: 0, seq: 0 },
  actions,
}: {
  items: ChatItem[];
  label: string;
  english: boolean;
  named?: boolean;
  fresh?: { n: number; seq: number };
  actions?: (m: ChatItem) => ReactNode;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const log = useRef<HTMLOListElement>(null);
  const pinned = useRef(true);
  useEffect(() => {
    if (log.current && pinned.current) log.current.scrollTop = log.current.scrollHeight;
  }, [items]);
  return (
    <>
      <ol
        className="chat-log"
        ref={log}
        tabIndex={0}
        aria-label={label}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {items.map((m) => (
          <li key={m.id} data-mine={m.mine || undefined}>
            <div className="chat-meta">
              {named && <b>{m.mine ? t('我', 'You') : (m.name ?? t('已退出的成员', 'Former member'))}</b>}
              <time dateTime={new Date(m.createdAt).toISOString()}>{when(m.createdAt, english)}</time>
              {actions?.(m)}
            </div>
            <p className="chat-body">{m.body}</p>
          </li>
        ))}
        {!items.length && <li className="chat-empty">{t('还没有消息，打个招呼吧。', 'No messages yet. Say hello.')}</li>}
      </ol>
      <p className="sr-only" aria-live="polite">
        {/* A new node per answer: two polls with one new line each are both read. */}
        {fresh.n > 0 && (
          <span key={fresh.seq}>{t(`${fresh.n} 条新消息`, `${fresh.n} new message${fresh.n > 1 ? 's' : ''}`)}</span>
        )}
      </p>
    </>
  );
}

/** The write box: Enter sends (not mid-IME), Shift+Enter breaks the line. Resolves true when sent. */
export function ChatCompose({
  label,
  english,
  disabled,
  send,
}: {
  label: string;
  english: boolean;
  disabled?: boolean;
  send: (body: string) => Promise<boolean>;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    if (await send(draft)) setDraft('');
    setBusy(false);
  }
  return (
    <form className="chat-compose" onSubmit={(e) => void submit(e)}>
      <textarea
        value={draft}
        rows={2}
        maxLength={MAX}
        aria-label={label}
        placeholder={t('Enter 发送，Shift+Enter 换行', 'Enter to send, Shift+Enter for a new line')}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void submit();
          }
        }}
      />
      <button type="submit" disabled={disabled || busy || !draft.trim()}>
        <Send size={14} aria-hidden="true" />
        {t('发送', 'Send')}
      </button>
    </form>
  );
}

/**
 * Report with a reason; one per learner, read by instructors in the teacher view. `body` names
 * what is reported where the path does not (a chat or direct message).
 */
export function Report({ path, english, body }: { path: string; english: boolean; body?: Record<string, string> }) {
  const t = (zh: string, en: string) => (english ? en : zh);
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
      await api(path, { ...body, reason });
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
        {/* A chat line is never a solution. */}
        {!body && <option value="wrong">{t('解法有误', 'Wrong solution')}</option>}
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
