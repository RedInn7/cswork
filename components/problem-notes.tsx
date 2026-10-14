'use client';
import { useEffect, useRef, useState } from 'react';
import { NotebookPen, Repeat, Star } from 'lucide-react';
import { api } from '@/lib/types';
import { readLocale } from '@/lib/i18n';
import { NOTE_MAX_BYTES } from '@/lib/practice-review';
import { StatementMarkdown } from './statement-markdown';
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
function readDraft(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeDraft(key: string, body: string | null) {
  try {
    if (body === null) localStorage.removeItem(key);
    else localStorage.setItem(key, body);
  } catch {}
}
async function putNote(target: string, body: string) {
  const response = await fetch(
    `/api/oj/notes?target=${encodeURIComponent(target)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Locale': readLocale() },
      body: JSON.stringify({ body }),
    },
  );
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(typeof result?.error === 'string' ? result.error : '');
  }
}

export type ProblemNote = ReturnType<typeof useProblemNote>;

/**
 * The learner's private note on one problem. Saves `delay` ms after typing stops,
 * one request at a time and always the newest text. A failed save keeps a local
 * draft, which wins over the server copy and is sent again on the next visit.
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
  // What the learner typed last and what the server holds; equal means saved.
  const latest = useRef('');
  const sent = useRef('');
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
        await putNote(target, body);
        sent.current = body;
      }
      writeDraft(key, unsaved() ? latest.current : null);
      setError('');
      setState(unsaved() ? 'too-long' : 'saved');
    } catch (reason) {
      writeDraft(key, latest.current);
      setError((reason as Error).message);
      setState('unsaved');
    } finally {
      busy.current = false;
    }
  }

  useEffect(() => {
    if (!userId) return;
    let current = true;
    api<{ body?: unknown }>(`oj/notes?target=${encodeURIComponent(target)}`)
      .then((result) => {
        if (!current) return;
        const server = typeof result.body === 'string' ? result.body : '';
        const draft = readDraft(key);
        sent.current = server;
        latest.current = draft ?? server;
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
    const keep = () => {
      if (unsaved()) writeDraft(key, latest.current);
    };
    window.addEventListener('pagehide', keep);
    return () => {
      window.removeEventListener('pagehide', keep);
      clearTimeout(timer.current);
      // Leaving the problem: save now instead of after the pause.
      if (unsaved()) writeDraft(key, latest.current);
      if (sendable()) void flush();
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- unsaved, sendable and flush read refs only.
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
      {!preview ? (
        <textarea
          className="cs-notes-input"
          aria-label={t('笔记内容', 'Note')}
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
      {error && (
        <span role="alert" className="sr-only">
          {t('标记没有保存：', 'Mark not saved: ')}
          {error}
        </span>
      )}
    </div>
  );
}
