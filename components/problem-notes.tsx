'use client';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { NotebookPen, Repeat, Star } from 'lucide-react';
import { api } from '@/lib/types';
import { readLocale } from '@/lib/i18n';
import { NOTE_MAX_BYTES } from '@/lib/practice-review';
import { PROBLEM_TEMPLATE, wikiLinks } from '@/lib/note-meta';
import { STOP_NAMES } from '@/lib/route-stops';
import { StatementMarkdown } from './statement-markdown';
import { AskedReport, communityProblem } from './problem-community';
import '@/app/problem-notes.css';

const CardEditor = lazy(() => import('./card-editor').then((m) => ({ default: m.CardEditor })));

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
/**
 * Text written signed out and kept by the caller, handed to the note's local draft: on its next
 * load it is saved if the account has no note yet, or offered beside the saved one. False (keep
 * it) while an unsaved draft of the account's is still there.
 */
export function stashNoteDraft(userId: string, target: string, body: string) {
  const key = draftKey(userId, target);
  if (readDraft(key)) return false;
  writeDraft(key, { body, base: null });
  return true;
}
const stamp = (value: unknown) => (typeof value === 'number' ? value : null);
/** Saves the note and returns the server's new updatedAt; `keepalive` lets a save sent as the page leaves finish. */
export async function putNote(target: string, body: string, keepalive = false) {
  const response = await fetch(
    `/api/oj/notes?target=${encodeURIComponent(target)}`,
    {
      method: 'PUT',
      keepalive,
      headers: { 'Content-Type': 'application/json', 'X-Locale': readLocale() },
      body: JSON.stringify({ body }),
    },
  );
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(typeof result?.error === 'string' ? result.error : '');
  return stamp(result?.updatedAt);
}

export type ProblemNote = ReturnType<typeof useNote>;

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
  return useNote(userId, `problem:${problemId}`, delay);
}

/**
 * The same for any note target (`content:<type>/<slug>`: a written answer). Key the caller by target.
 * What a guest types (or `guestText`, kept by the caller) is saved to the account on sign-in.
 */
export function useNote(userId: string | null, target: string, delay = 800, guestText = '') {
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
  // What a guest typed before signing in; it becomes the note once they do.
  const guest = useRef(userId ? '' : guestText);
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
        const typed = guest.current;
        guest.current = '';
        if (typed.trim() && typed !== latest.current) {
          if (!latest.current.trim()) latest.current = typed;
          else lost ??= typed;
        }
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
    if (!userId) guest.current = value;
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

type Backlink = { target: string; snippet: string; updatedAt: number };
const TEMPLATE_TARGET = 'pref:note-template';
const TEMPLATE_MAX = 4096;
/** Where a backlinking note lives: its problem, written answer or stop page (a submission note has none). */
function noteLink(target: string, t: T): [string, string | null] {
  const [kind, rest] = [target.slice(0, target.indexOf(':')), target.slice(target.indexOf(':') + 1)];
  if (kind === 'problem')
    return [/^lc-\d+$/.test(rest) ? `LC ${rest.slice(3)}` : rest, `/?${new URLSearchParams({ view: 'problem', problem: rest })}`];
  // ponytail: /topics/<slug> by hand; topicPath's module carries 160 KB of templates.
  if (kind === 'topic') return [t(`套路笔记 · ${STOP_NAMES[rest]?.[0] ?? rest}`, `Pattern notes · ${STOP_NAMES[rest]?.[1] ?? rest}`), `/topics/${rest}`];
  const content = /^(\w+)\/(.+)$/.exec(rest);
  if (kind === 'content' && content)
    return [content[2], `/?${new URLSearchParams({ view: 'content', type: content[1], slug: content[2] })}`];
  return [t('提交笔记', 'Submission note'), null];
}

/**
 * The note editor. With `problemId` it adds the problem template (the learner's own, saved with
 * "Set as my template", or the built-in one) and, under the preview, the learner's other notes
 * that link [[problemId]]. With `card` (never in an exam) a written note can become a review card.
 */
export function ProblemNotes({
  note,
  english,
  problemId,
  card,
}: {
  note: ProblemNote;
  english: boolean;
  problemId?: string;
  card?: { title: string; href: string };
}) {
  const [making, setMaking] = useState(false);
  const t: T = (zh, en) => (english ? en : zh);
  const [preview, setPreview] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const [said, setSaid] = useState('');
  const [links, setLinks] = useState<Backlink[] | null>(null);
  const linkable = !!problemId && /^(lc|oa)-[a-z0-9-]+$/.test(problemId);
  // Read the first time the preview opens.
  useEffect(() => {
    if (!preview || !linkable || !note.enabled || links) return;
    let current = true;
    api<{ items?: Backlink[] }>(`oj/notes/backlinks?problem=${encodeURIComponent(problemId!)}`)
      .then((result) => current && setLinks(Array.isArray(result.items) ? result.items : []))
      .catch(() => current && setLinks([]));
    return () => {
      current = false;
    };
  }, [preview, linkable, note.enabled, links, problemId]);
  const size = bytes(note.text);
  async function insertTemplate() {
    let template = PROBLEM_TEMPLATE[english ? 'en' : 'zh'];
    try {
      const saved = await api<{ body?: unknown }>(`oj/notes?target=${encodeURIComponent(TEMPLATE_TARGET)}`);
      // ponytail: a type check, not zod: the schema is one string and zod would join the workspace bundle.
      const mine: unknown = typeof saved.body === 'string' && saved.body ? JSON.parse(saved.body)?.problem : null;
      if (typeof mine === 'string' && mine.trim() && bytes(mine) <= TEMPLATE_MAX) template = mine;
    } catch {}
    // Read after the request, so what was typed meanwhile stays.
    const text = area.current?.value ?? note.text;
    const at = area.current?.selectionStart ?? text.length;
    const end = area.current?.selectionEnd ?? at;
    const before = text.slice(0, at);
    // Its ## headings need a line of their own, and what follows must not join its last line (a closing
    // `#` would turn "## Pattern" into "### Pattern" and "Two pointers" into the tag #two).
    const gap = before && !before.endsWith('\n') ? '\n\n' : '';
    const rest = text.slice(end);
    const tail = rest && !rest.startsWith('\n') ? '\n\n' : '';
    note.edit(before + gap + template + tail + rest);
    setPreview(false);
    setSaid('');
    requestAnimationFrame(() => {
      const cursor = at + gap.length + template.length;
      area.current?.focus();
      area.current?.setSelectionRange(cursor, cursor);
    });
  }
  async function saveTemplate() {
    // An empty note puts the built-in template back.
    const body = note.text.trim() ? JSON.stringify({ problem: note.text }) : '';
    if (bytes(body) > TEMPLATE_MAX)
      return setSaid(t('模板最多 4 KB，删减后再设。', 'A template can be at most 4 KB. Shorten it first.'));
    try {
      await putNote(TEMPLATE_TARGET, body);
      setSaid(
        body
          ? t('已设为你的模板，之后「插入模板」都用它。', 'Saved as your template. "Insert template" uses it from now on.')
          : t('笔记是空的，已换回内置模板。', 'The note is empty, so the built-in template is back.'),
      );
    } catch (reason) {
      setSaid((reason as Error).message || t('模板没有保存。', "The template wasn't saved."));
    }
  }
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
            '只有你能看到。支持 Markdown、#标签、「把握度: 1–5」和 [[lc-42]] 双链，停下输入就自动保存。',
            'Only you can see this. Markdown, #tags, "Confidence: 1–5" and [[lc-42]] links work, and it saves when you pause.',
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
      {problemId && (
        <div className="cs-notes-tools">
          <button type="button" disabled={note.conflict !== null} onClick={() => void insertTemplate()}>
            {t('插入模板', 'Insert template')}
          </button>
          <button
            type="button"
            title={t('把这条笔记存成「插入模板」用的模板；笔记为空时换回内置模板', 'Save this note as the template "Insert template" uses; an empty note restores the built-in one')}
            onClick={() => void saveTemplate()}
          >
            {t('设为我的模板', 'Set as my template')}
          </button>
          {card && note.has && (
            <button type="button" onClick={() => setMaking(true)}>
              {t('做成记忆卡', 'Make a review card')}
            </button>
          )}
          <span role="status">{said}</span>
        </div>
      )}
      {card && making && (
        <Suspense fallback={null}>
          <CardEditor
            initial={{
              front: t(`${card.title}：思路是什么？`, `${card.title}: what is the approach?`),
              back: note.text,
              src: { href: card.href, title: card.title.slice(0, 200) },
            }}
            onClose={() => setMaking(false)}
          />
        </Suspense>
      )}
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
          ref={area}
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
          body={wikiLinks(note.text)}
          className="cs-statement-markdown cs-notes-preview"
        />
      ) : (
        <p className="cs-notes-empty">{t('还没有内容。', 'Nothing written yet.')}</p>
      )}
      {preview && links && (
        <section className="cs-notes-links" aria-labelledby="cs-notes-links">
          <h3 id="cs-notes-links">{t('提到这道题的笔记', 'Notes that mention this problem')}</h3>
          {links.length ? (
            <ul>
              {links.map((link) => {
                const [label, href] = noteLink(link.target, t);
                return (
                  <li key={link.target}>
                    {href ? <a href={href}>{label}</a> : <strong>{label}</strong>}
                    <span>{link.snippet}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>
              {t(
                `还没有。在别的笔记里写 [[${problemId}]]，就会列在这里。`,
                `None yet. Write [[${problemId}]] in another note and it shows up here.`,
              )}
            </p>
          )}
        </section>
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
      {communityProblem(problemId) && (
        <AskedReport problemId={problemId} english={english} />
      )}
      {error && (
        <span role="alert" className="sr-only">
          {t('标记没有保存：', 'Mark not saved: ')}
          {error}
        </span>
      )}
    </div>
  );
}
