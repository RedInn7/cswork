'use client';
import { useEffect, useRef, useState } from 'react';
import { NotebookPen, Repeat, Star } from 'lucide-react';
import { api } from '@/lib/types';
import { readLocale } from '@/lib/i18n';
import { NOTE_MAX_BYTES } from '@/lib/practice-review';
import { StatementMarkdown } from './statement-markdown';
import { AskedReport, ListMenu } from './problem-community';
import '@/app/problem-notes.css';

type T = (zh: string, en: string) => string;
type NoteState =
  | 'loading'
  | 'load-failed'
  | 'idle'
  | 'saving'
  | 'saved'
  | 'unsaved'
  | 'too-long';

const bytes = (text: string) => new TextEncoder().encode(text).length;
const draftKey = (userId: string, target: string) =>
  `cswork:note-draft:${userId}:${target}`;
/** `base` is the server's updatedAt the draft was written over (null: no note yet). */
type Draft = { body: string; base: number | null };
function readDraft(key: string): Draft | null {
  try {
    const draft = JSON.parse(localStorage.getItem(key) ?? 'null');
    return typeof draft?.body === 'string'
      ? { body: draft.body, base: typeof draft.base === 'number' ? draft.base : null }
      : null;
  } catch {
    return null;
  }
}
function writeDraft(key: string, draft: Draft | null) {
  try {
    if (draft === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(draft));
  } catch {}
}
const stamp = (value: unknown) => (typeof value === 'number' ? value : null);
/** Saves the note and returns the server's new updatedAt. */
async function putNote(target: string, body: string) {
  const response = await fetch(
    `/api/oj/notes?target=${encodeURIComponent(target)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Locale': readLocale() },
      body: JSON.stringify({ body }),
    },
  );
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(typeof result?.error === 'string' ? result.error : '');
  return stamp(result?.updatedAt);
}

export type ProblemNote = ReturnType<typeof useProblemNote>;

/**
 * The learner's private note on one problem. Saves `delay` ms after typing stops,
 * one request at a time and always the newest text. A failed save keeps a local
 * draft, sent again on the next visit if the server copy is still the one it was
 * written over; if the note changed elsewhere since, the learner picks which to keep.
 * `userId` null (guests, a running mock exam) turns it off.
 */
export function useProblemNote(
  userId: string | null,
  problemId: string,
  delay = 800,
) {
  const target = `problem:${problemId}`;
  const key = userId ? draftKey(userId, target) : '';
  const [text, setText] = useState('');
  const [state, setState] = useState<NoteState>('loading');
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  // A local draft that lost to a newer server copy, until the learner chooses.
  const [conflict, setConflict] = useState<string | null>(null);
  // What the learner typed last and what the server holds; equal means saved.
  const latest = useRef('');
  const sent = useRef('');
  const base = useRef<number | null>(null);
  const keep = (body: string | null) =>
    writeDraft(key, body === null ? null : { body, base: base.current });
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const unsaved = () => sent.current !== latest.current;
  // An over-size note stays a local draft until it is shortened.
  const sendable = () => unsaved() && bytes(latest.current) <= NOTE_MAX_BYTES;

  async function flush() {
    if (busy.current || !userId) return;
    busy.current = true;
    try {
      while (sendable()) {
        const body = latest.current;
        setState('saving');
        base.current = await putNote(target, body);
        sent.current = body;
      }
      keep(unsaved() ? latest.current : null);
      setError('');
      setState(unsaved() ? 'too-long' : 'saved');
    } catch (reason) {
      keep(latest.current);
      setError((reason as Error).message);
      setState('unsaved');
    } finally {
      busy.current = false;
    }
  }

  useEffect(() => {
    if (!userId) return;
    let current = true;
    api<{ body?: unknown; updatedAt?: unknown }>(
      `oj/notes?target=${encodeURIComponent(target)}`,
    )
      .then((result) => {
        if (!current) return;
        const server = typeof result.body === 'string' ? result.body : '';
        base.current = stamp(result.updatedAt);
        sent.current = latest.current = server;
        const draft = readDraft(key);
        let lost: string | null = null;
        // Already saved (the request outlived the tab), or nothing to restore.
        if (!draft || draft.body === server) keep(null);
        else if (draft.base === base.current) latest.current = draft.body;
        // Never overwrite a note changed elsewhere since the draft was written.
        else lost = draft.body;
        setConflict(lost);
        setText(latest.current);
        setState(sendable() || !unsaved() ? 'idle' : 'too-long');
        if (sendable()) void flush();
      })
      .catch((reason: Error) => {
        if (!current) return;
        setError(reason.message);
        setState('load-failed');
      });
    return () => {
      current = false;
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- flush reads refs only; reload retries a failed load.
  }, [userId, target, key, reload]);

  useEffect(() => {
    if (!userId) return;
    // Closing the tab cannot wait for a request; the draft is sent on the next visit.
    const stash = () => {
      if (unsaved()) keep(latest.current);
    };
    window.addEventListener('pagehide', stash);
    return () => {
      window.removeEventListener('pagehide', stash);
      clearTimeout(timer.current);
      // Leaving the problem: save now instead of after the pause.
      stash();
      if (sendable()) void flush();
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- stash, sendable and flush read refs only.
  }, [userId, key]);

  function edit(value: string) {
    latest.current = value;
    setText(value);
    clearTimeout(timer.current);
    if (bytes(value) > NOTE_MAX_BYTES) setState('too-long');
    else timer.current = setTimeout(() => void flush(), delay);
  }
  return {
    enabled: !!userId,
    text,
    state,
    error,
    conflict,
    /** Resolve a conflict: send this device's draft, or drop it for the server copy. */
    resolve(useDraft: boolean) {
      if (conflict === null) return;
      setConflict(null);
      if (!useDraft) return keep(null);
      edit(conflict);
      keep(conflict);
      clearTimeout(timer.current);
      if (sendable()) void flush();
    },
    has: state !== 'loading' && state !== 'load-failed' && !!text.trim(),
    edit,
    retry() {
      if (state !== 'load-failed') return void flush();
      setState('loading');
      setReload((n) => n + 1);
    },
  };
}

/** The Notes tab button, with a dot once the problem has a note. */
export function NotesTab({
  note,
  active,
  onSelect,
  english,
}: {
  note: ProblemNote;
  active: boolean;
  onSelect: () => void;
  english: boolean;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      className={active ? 'active' : ''}
      onClick={onSelect}
    >
      <NotebookPen size={15} />
      {english ? 'Notes' : '笔记'}
      {note.has && (
        <i className="cs-tab-dot">
          <span className="sr-only">{english ? ' (has a note)' : '（已有笔记）'}</span>
        </i>
      )}
    </button>
  );
}

export function ProblemNotes({
  note,
  english,
}: {
  note: ProblemNote;
  english: boolean;
}) {
  const t: T = (zh, en) => (english ? en : zh);
  const [preview, setPreview] = useState(false);
  const size = bytes(note.text);
  if (note.state === 'loading')
    return (
      <output className="cs-notes-state">
        {t('正在加载笔记…', 'Loading your note…')}
      </output>
    );
  if (note.state === 'load-failed')
    return (
      <div className="cs-notes-state" role="alert">
        <p>
          {t('笔记加载失败。', "Couldn't load your note.")} {note.error}
        </p>
        <button type="button" onClick={note.retry}>
          {t('重试', 'Retry')}
        </button>
      </div>
    );
  const routine = {
    idle: '',
    saving: t('正在保存…', 'Saving…'),
    saved: t('已保存', 'Saved'),
  } as Record<NoteState, string>;
  return (
    <section className="cs-notes" aria-label={t('私人笔记', 'Private note')}>
      <header className="cs-notes-head">
        <p>
          {t(
            '只有你能看到。支持 Markdown，停下输入就自动保存。',
            'Only you can see this. Markdown works, and it saves when you pause.',
          )}
        </p>
        <fieldset className="cs-notes-switch">
          <legend className="sr-only">{t('笔记视图', 'Note view')}</legend>
          <button
            type="button"
            aria-pressed={!preview}
            onClick={() => setPreview(false)}
          >
            {t('编辑', 'Write')}
          </button>
          <button
            type="button"
            aria-pressed={preview}
            onClick={() => setPreview(true)}
          >
            {t('预览', 'Preview')}
          </button>
        </fieldset>
      </header>
      {note.conflict !== null && (
        <div className="cs-notes-conflict" role="alert">
          <p>
            {t(
              '这台设备上有一份没保存的旧版本，但这条笔记之后在别处改过了。下面显示的是最新保存的内容。',
              'This device has an older unsaved version, but the note was changed elsewhere since. The latest saved note is shown below.',
            )}
          </p>
          <details>
            <summary>{t('查看这台设备上的版本', "Show this device's version")}</summary>
            <pre>{note.conflict}</pre>
          </details>
          <div className="cs-notes-conflict-actions">
            <button type="button" onClick={() => note.resolve(true)}>
              {t('改用这台设备的版本', "Use this device's version")}
            </button>
            <button type="button" onClick={() => note.resolve(false)}>
              {t('丢弃它', 'Discard it')}
            </button>
          </div>
        </div>
      )}
      {!preview ? (
        <textarea
          className="cs-notes-input"
          aria-label={t('笔记内容', 'Note')}
          readOnly={note.conflict !== null}
          value={note.text}
          onChange={(event) => note.edit(event.target.value)}
          placeholder={t(
            '思路、易错点、复杂度、下次想换的写法……',
            'Approach, pitfalls, complexity, what to try next time…',
          )}
          spellCheck={false}
        />
      ) : note.text.trim() ? (
        <StatementMarkdown
          body={note.text}
          className="cs-statement-markdown cs-notes-preview"
        />
      ) : (
        <p className="cs-notes-empty">{t('还没有内容。', 'Nothing written yet.')}</p>
      )}
      <footer className="cs-notes-foot">
        {note.state === 'unsaved' ? (
          <span role="alert" className="cs-notes-warn">
            {t(
              '没能保存，已暂存在这台设备，下次打开会自动补存。',
              "Couldn't save. A copy is kept on this device and will be saved next time.",
            )}{' '}
            {note.error}{' '}
            <button type="button" onClick={note.retry}>
              {t('重试', 'Retry')}
            </button>
          </span>
        ) : note.state === 'too-long' ? (
          <span role="alert" className="cs-notes-warn">
            {t('超过 20 KB，删减后才会保存。', 'Over 20 KB. Shorten it to save.')}
          </span>
        ) : (
          <span>{routine[note.state]}</span>
        )}
        <span
          className="cs-notes-size"
          data-over={size > NOTE_MAX_BYTES || undefined}
        >
          {(size / 1024).toFixed(1)} / 20 KB
        </span>
      </footer>
    </section>
  );
}

/** Star and redo-later toggles for the problem title row. */
export function ProblemMarks({
  problemId,
  english,
}: {
  problemId: string;
  english: boolean;
}) {
  const t: T = (zh, en) => (english ? en : zh);
  const target = `problem:${problemId}`;
  const [marks, setMarks] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    api<{ items?: { mark: string }[] }>(
      `oj/marks?target=${encodeURIComponent(target)}`,
    )
      .then((result) => {
        if (current && Array.isArray(result.items))
          setMarks(new Set(result.items.map((item) => item.mark)));
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [target]);
  const set = (mark: string, on: boolean) =>
    setMarks((previous) => {
      const next = new Set(previous);
      if (on) next.add(mark);
      else next.delete(mark);
      return next;
    });
  async function toggle(mark: 'star' | 'redo') {
    const on = !marks.has(mark);
    set(mark, on);
    setError('');
    try {
      await api('oj/marks', { target, mark, on });
    } catch (reason) {
      set(mark, !on);
      setError((reason as Error).message);
    }
  }
  return (
    <div className="cs-problem-marks">
      {(
        [
          ['star', Star, '收藏', 'Star'],
          ['redo', Repeat, '稍后重做', 'Redo later'],
        ] as const
      ).map(([mark, Icon, zh, en]) => (
        <button
          key={mark}
          type="button"
          className="cs-mark"
          data-mark={mark}
          aria-pressed={marks.has(mark)}
          aria-label={t(zh, en)}
          title={t(zh, en)}
          onClick={() => void toggle(mark)}
        >
          <Icon size={17} aria-hidden="true" />
        </button>
      ))}
      <ListMenu problemId={problemId} english={english} />
      <AskedReport problemId={problemId} english={english} />
      {error && (
        <span role="alert" className="sr-only">
          {t('标记没有保存：', 'Mark not saved: ')}
          {error}
        </span>
      )}
    </div>
  );
}
