'use client';

import { useEffect, useState } from 'react';
import { readLocale } from '@/lib/i18n';
import { ojRequest } from '@/lib/oj-client';
import { parseProjectNote, projectNote, projectTarget, REPO_LINK, REPO_MAX } from '@/lib/resume-projects';
import '@/app/projects/projects.css';

type Marks = { items: { target: string; mark: string }[] };
type State = 'doing' | 'done' | null;
const PREFIX = projectTarget('');

/** A project's state from its marks: done wins over doing. */
const stateFrom = (marks: Marks['items'], slug: string): State => {
  const own = marks.filter((m) => m.target === projectTarget(slug)).map((m) => m.mark);
  return own.includes('done') ? 'done' : own.includes('doing') ? 'doing' : null;
};

let shared: Promise<Marks['items']> | null = null;
/** The learner's project marks, fetched once for every card on /projects; signed out it rejects. */
const projectMarks = () =>
  (shared ??= ojRequest<Marks>('marks').then(
    (r) => r.items.filter((m) => m.target.startsWith(PREFIX)),
    (error: unknown) => {
      shared = null;
      throw error;
    },
  ));

/** "In progress" / "Done" on a /projects card; nothing for guests or untouched projects. */
export function ProjectState({ slug, zh }: { slug: string; zh: boolean }) {
  const [state, setState] = useState<State>(null);
  useEffect(() => {
    let live = true;
    projectMarks().then(
      (marks) => live && setState(stateFrom(marks, slug)),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [slug]);
  if (!state) return null;
  return (
    <span className="projects-state" data-state={state}>
      {state === 'done' ? (zh ? '已完成' : 'Done') : zh ? '进行中' : 'In progress'}
    </span>
  );
}

/**
 * A project page's start / done buttons (user_marks 'doing' and 'done' on content:project/<slug>)
 * and the learner's repo link, a private note only they see. Guests are asked to sign in.
 */
export function ProjectProgress({ slug, zh }: { slug: string; zh: boolean }) {
  const t = (cn: string, en: string) => (zh ? cn : en);
  const [state, setState] = useState<State | 'loading' | 'guest'>('loading');
  const [repo, setRepo] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const noteUrl = `notes?target=${encodeURIComponent(projectNote(slug))}`;

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      ojRequest<Marks>(`marks?target=${encodeURIComponent(projectTarget(slug))}`, undefined, controller.signal),
      ojRequest<{ body: string }>(noteUrl, undefined, controller.signal),
    ]).then(
      ([marks, note]) => {
        setState(stateFrom(marks.items, slug));
        const saved = parseProjectNote(note.body) ?? '';
        setRepo(saved);
        setDraft(saved);
      },
      () => !controller.signal.aborted && setState('guest'),
    );
    return () => controller.abort();
  }, [slug, noteUrl]);

  if (state === 'loading') return null;
  if (state === 'guest')
    return (
      <div className="project-progress">
        <a href="/?view=account">{t('登录后可以记录进度，并保存你的仓库链接', 'Sign in to track your progress and keep your repo link')}</a>
      </div>
    );

  /** Each change is one or two mark writes; the state shown is the one they leave. */
  const move = async (next: State) => {
    setBusy(true);
    setMessage(null);
    const target = projectTarget(slug);
    try {
      if (next === 'done') await ojRequest('marks', { target, mark: 'done', on: true });
      if (next !== 'done' && state === 'done') await ojRequest('marks', { target, mark: 'done', on: false });
      await ojRequest('marks', { target, mark: 'doing', on: next === 'doing' });
      setState(next);
    } catch (error) {
      setMessage({ error: true, text: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const save = async (event: { preventDefault(): void }) => {
    event.preventDefault();
    const link = draft.trim();
    if (link && (link.length > REPO_MAX || !REPO_LINK.test(link))) {
      setMessage({ error: true, text: t('请填写 GitHub、GitLab 或 Codeberg 上的 https 仓库地址', 'Use an https repository address on GitHub, GitLab or Codeberg') });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/oj/${noteUrl}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Locale': readLocale() },
        // An empty note is removed (lib/server/my-practice.ts).
        body: JSON.stringify({ body: link ? JSON.stringify({ repo: link }) : '' }),
      });
      const reply = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(reply?.error || t('保存失败，请稍后再试', 'Could not save; try again later'));
      setRepo(link);
      setDraft(link);
      setMessage({ error: false, text: link ? t('已保存', 'Saved') : t('已删除', 'Removed') });
    } catch (error) {
      setMessage({ error: true, text: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="project-progress" data-state={state ?? undefined}>
      <div className="project-progress-actions">
        <span className="project-progress-label">
          {state === 'done' ? t('已完成', 'Done') : state === 'doing' ? t('进行中', 'In progress') : t('还没开始', 'Not started')}
        </span>
        {state === null && (
          <button type="button" data-primary disabled={busy} onClick={() => void move('doing')}>
            {t('开始做', 'Start')}
          </button>
        )}
        {state !== 'done' && (
          <button type="button" data-primary={state === 'doing' || undefined} disabled={busy} onClick={() => void move('done')}>
            {t('标记完成', 'Mark done')}
          </button>
        )}
        {state === 'doing' && (
          <button type="button" disabled={busy} onClick={() => void move(null)}>
            {t('先不做了', 'Stop for now')}
          </button>
        )}
        {state === 'done' && (
          <button type="button" disabled={busy} onClick={() => void move('doing')}>
            {t('改回进行中', 'Back to in progress')}
          </button>
        )}
      </div>
      <form onSubmit={(event) => void save(event)}>
        <label htmlFor={`project-repo-${slug}`}>
          {t('你的仓库链接（只有你自己能看到）', 'Your repository link (only you can see it)')}
        </label>
        <input
          id={`project-repo-${slug}`}
          type="url"
          inputMode="url"
          placeholder="https://github.com/you/project"
          maxLength={REPO_MAX}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" disabled={busy || draft.trim() === repo}>
          {t('保存', 'Save')}
        </button>
      </form>
      {repo && (
        <p className="project-progress-repo">
          <a href={repo} target="_blank" rel="noopener noreferrer">
            {repo}
          </a>
        </p>
      )}
      <p className={message?.error ? 'project-progress-error' : 'project-progress-status'} role="status">
        {message?.text}
      </p>
    </div>
  );
}
