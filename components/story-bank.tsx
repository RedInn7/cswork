'use client';
import { useEffect, useId, useMemo, useState } from 'react';
import { BookUser, Download, ExternalLink, Plus, Trash2, X } from 'lucide-react';
import { api } from '@/lib/types';
import { useLocale, useT } from '@/lib/i18n';
import {
  COMPETENCIES, STAR, STAR_NAMES, assignStory, blankStory, competenciesFor, competencyName, parseStory,
  rankStories, speakingSeconds, storiesMarkdown, storyBody, storyTarget, wordCount,
  type Story, type StoryQuestion,
} from '@/lib/story-bank';
import { putNote } from './problem-notes';
import '@/app/redesign.css';
import '@/app/interview-prep.css';

/** The learner's stories, stored as their notes (`story:<id>`, JSON); null while loading. */
function useStories(userId: string | null) {
  const [stories, setStories] = useState<Story[] | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!userId) return;
    let current = true;
    api<{ items: { target: string; body: string; updatedAt: number }[] }>('oj/notes?prefix=story%3A')
      .then((r) => {
        if (current) setStories(r.items.flatMap((i) => parseStory(i.target, i.body, i.updatedAt) ?? []));
      })
      .catch((e: Error) => current && setError(e.message));
    return () => {
      current = false;
    };
  }, [userId, reload]);
  return {
    stories,
    error,
    retry() {
      setError('');
      setReload((n) => n + 1);
    },
    async save(story: Story) {
      const updatedAt = await putNote(storyTarget(story.id), storyBody(story));
      const saved = { ...story, updatedAt };
      setStories((list) => [saved, ...(list ?? []).filter((s) => s.id !== story.id)]);
      return saved;
    },
    async remove(id: string) {
      // An emptied note is deleted.
      await putNote(storyTarget(id), '');
      setStories((list) => (list ?? []).filter((s) => s.id !== id));
    },
  };
}

const BANK = '/?view=stories';

/**
 * "Which story would you tell?" beside a behavioral question: the learner's stories, those sharing
 * a competency with the question first; the pick is saved on the story. Nothing for guests.
 */
export function StoryPicker({ userId, question, text }: { userId: string | null; question: StoryQuestion; text: string }) {
  const t = useT();
  const english = useLocale() === 'en';
  const id = useId();
  const { stories, error, retry, save } = useStories(userId);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const wanted = useMemo(() => competenciesFor(text), [text]);
  if (!userId) return null;
  const ranked = rankStories(stories ?? [], wanted, question.key);
  const fits = ranked.filter((r) => r.matches.length);
  const rest = ranked.filter((r) => !r.matches.length);
  const chosen = stories?.find((s) => s.questions.some((q) => q.key === question.key)) ?? null;
  async function choose(storyId: string) {
    setBusy(true);
    setSaveError('');
    try {
      for (const story of assignStory(stories ?? [], storyId || null, question)) await save(story);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const option = ({ story, matches }: (typeof ranked)[number]) => (
    <option key={story.id} value={story.id}>
      {(story.title.trim() || t('未命名故事', 'Untitled story')) +
        (matches.length ? ` · ${matches.map((c) => competencyName(c, english)).join(', ')}` : '')}
    </option>
  );
  return (
    <section className="ip-pick" aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`}>
        <BookUser size={15} aria-hidden="true" /> {t('你会讲哪个故事？', 'Which story would you tell?')}
      </h3>
      {!!wanted.length && (
        <p className="ip-pick-wants">
          <span>{t('这道题在考察', 'This question probes')}</span>
          {wanted.map((c) => (
            <span key={c} className="rd-badge">
              {competencyName(c, english)}
            </span>
          ))}
        </p>
      )}
      {stories === null ? (
        error ? (
          <p className="ip-warn" role="alert">
            {t('故事库没能加载。', "Couldn't load your stories.")} {error}{' '}
            <button type="button" onClick={retry}>
              {t('重试', 'Retry')}
            </button>
          </p>
        ) : (
          <p className="ip-muted">{t('正在加载你的故事…', 'Loading your stories…')}</p>
        )
      ) : !stories.length ? (
        <p className="ip-muted">
          {t('还没有故事。先在故事库写几个 STAR 故事，就能在这里挑。', 'No stories yet. Write a few STAR stories in your story bank to pick from here.')}
        </p>
      ) : (
        <select
          className="ip-pick-select"
          aria-labelledby={`${id}-h`}
          value={chosen?.id ?? ''}
          disabled={busy}
          onChange={(event) => void choose(event.target.value)}
        >
          <option value="">{t('— 还没选 —', '— Not chosen yet —')}</option>
          {!!fits.length && <optgroup label={t('能力项对得上', 'Fits this question')}>{fits.map(option)}</optgroup>}
          {!!rest.length && <optgroup label={t('其他故事', 'Other stories')}>{rest.map(option)}</optgroup>}
        </select>
      )}
      {saveError && (
        <p className="ip-warn" role="alert">
          {t('没能保存选择：', "Couldn't save your pick: ")}
          {saveError}
        </p>
      )}
      {chosen && (
        <details className="ip-pick-story">
          <summary>{t('回顾这个故事', 'Review this story')}</summary>
          <StarText story={chosen} english={english} />
        </details>
      )}
      <a className="ip-pick-bank" href={BANK} target="_blank" rel="noopener">
        {t('打开故事库', 'Open the story bank')} <ExternalLink size={12} aria-hidden="true" />
      </a>
    </section>
  );
}

function StarText({ story, english }: { story: Story; english: boolean }) {
  return (
    <dl className="ip-star">
      {STAR.filter((f) => story[f].trim()).map((f) => (
        <div key={f}>
          <dt>{STAR_NAMES[f][english ? 1 : 0]}</dt>
          <dd>{story[f]}</dd>
        </div>
      ))}
    </dl>
  );
}

const minutes = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const companiesOf = (story: Story) => [...new Set(story.questions.flatMap((q) => (q.company ? [q.company] : [])))];

/** ?view=stories: the STAR story bank. Signed-in only (the academy shell asks guests to sign in). */
export function StoryBank({ userId }: { userId: string }) {
  const t = useT();
  const locale = useLocale();
  const english = locale === 'en';
  const bank = useStories(userId);
  const [draft, setDraft] = useState<Story | null>(null);
  const stories = bank.stories;
  const covered = new Set(stories?.flatMap((s) => s.competencies));
  const lps = COMPETENCIES.filter((c) => c.lp);
  function exportMarkdown() {
    const url = URL.createObjectURL(new Blob([storiesMarkdown(stories ?? [], english)], { type: 'text/markdown' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'star-stories.md' });
    a.click();
    URL.revokeObjectURL(url);
  }
  const open = (story: Story) => {
    setDraft(story);
    requestAnimationFrame(() => document.getElementById('ip-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  return (
    <div className="rd ip">
      <div className="rd-page ip-bank">
        <header className="ip-bank-head rd-reveal" style={{ '--i': 0 } as React.CSSProperties}>
          <p className="ip-eyebrow">{t('行为面试 · Behavioral', 'Behavioral interviews')}</p>
          <h1>{t('STAR 故事库', 'STAR story bank')}</h1>
          <p className="ip-lead">
            {t(
              '把经历写成 STAR 故事（情境、任务、行动、结果），标上它能证明的能力项。六到八个好故事就能覆盖大多数行为题；模拟面试和题目页抽到行为题时，可以直接挑一个来讲。',
              'Write your experiences as STAR stories (Situation, Task, Action, Result) and tag what each one proves. Six to eight good stories cover most behavioral questions, and mock interviews and question pages let you pick one to tell.',
            )}
          </p>
          <div className="ip-bank-actions">
            <button type="button" className="rd-button" onClick={() => open(blankStory())}>
              <Plus size={15} aria-hidden="true" /> {t('写一个新故事', 'New story')}
            </button>
            <button type="button" className="rd-button is-quiet" disabled={!stories?.length} onClick={exportMarkdown}>
              <Download size={15} aria-hidden="true" /> {t('导出 Markdown', 'Export Markdown')}
            </button>
          </div>
        </header>

        {!!stories?.length && (
          <section className="ip-cover rd-reveal" style={{ '--i': 1 } as React.CSSProperties} aria-labelledby="ip-cover-h">
            <h2 id="ip-cover-h">
              {t('Amazon Leadership Principles 覆盖', 'Amazon Leadership Principles covered')}{' '}
              <b>
                {lps.filter((c) => covered.has(c.id)).length} / {lps.length}
              </b>
            </h2>
            <ul>
              {lps.map((c) => (
                <li key={c.id} data-on={covered.has(c.id) || undefined}>
                  {c.name[english ? 1 : 0]}
                  <span className="sr-only">{covered.has(c.id) ? t('（已覆盖）', ' (covered)') : t('（未覆盖）', ' (not covered)')}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {draft && (
          <StoryEditor
            key={draft.id}
            story={draft}
            english={english}
            onSave={bank.save}
            onDelete={async (id) => {
              await bank.remove(id);
              setDraft(null);
            }}
            onClose={() => setDraft(null)}
            isNew={!stories?.some((s) => s.id === draft.id)}
          />
        )}

        {stories === null ? (
          bank.error ? (
            <div className="rd-card js-empty" role="alert">
              <strong>{t('故事库没能加载', "Couldn't load your stories")}</strong>
              <span>{bank.error}</span>
              <button type="button" className="rd-button" onClick={bank.retry}>
                {t('重试', 'Retry')}
              </button>
            </div>
          ) : (
            <div className="rd-card ip-skeleton" aria-busy="true" />
          )
        ) : !stories.length ? (
          !draft && (
            <div className="rd-card js-empty">
              <strong>{t('还没有故事', 'No stories yet')}</strong>
              <span>
                {t(
                  '从最有把握的一段经历开始：一个解决过的难题、一次分歧、一次失败。',
                  'Start with the experience you know best: a hard problem you solved, a disagreement, a failure.',
                )}
              </span>
            </div>
          )
        ) : (
          <div className="rd-card ip-table-wrap">
            <table className="ip-table">
              <caption className="sr-only">{t('我的故事', 'My stories')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('故事', 'Story')}</th>
                  <th scope="col">{t('能力项', 'Competencies')}</th>
                  <th scope="col">{t('公司', 'Companies')}</th>
                  <th scope="col">{t('用于', 'Answers')}</th>
                  <th scope="col">{t('更新', 'Updated')}</th>
                </tr>
              </thead>
              <tbody>
                {stories.map((s) => (
                  <tr key={s.id} aria-current={draft?.id === s.id || undefined}>
                    <th scope="row">
                      <button type="button" onClick={() => open(s)}>
                        {s.title.trim() || t('未命名故事', 'Untitled story')}
                      </button>
                    </th>
                    <td>
                      <span className="ip-tags">
                        {s.competencies.map((c) => (
                          <span key={c} className="rd-badge">
                            {competencyName(c, english)}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td>{companiesOf(s).join(', ') || '—'}</td>
                    <td>{s.questions.length ? t(`${s.questions.length} 道题`, `${s.questions.length} question${s.questions.length > 1 ? 's' : ''}`) : '—'}</td>
                    <td>
                      {s.updatedAt
                        ? new Date(s.updatedAt).toLocaleDateString(english ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric' })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const GUIDE: Record<(typeof STAR)[number], [zh: string, en: string]> = {
  situation: ['一两句交代背景：在哪、什么项目、为什么重要。', 'A sentence or two: where, what project, why it mattered.'],
  task: ['你负责什么，难点或风险在哪。', 'What you owned, and what made it hard or risky.'],
  action: ['重点：你本人做了什么、为什么这么做。约占整个故事的六成。', 'The core: what you did and why. About 60% of the story.'],
  result: ['用数字说结果，再加一句你学到了什么。', 'The outcome in numbers, plus one line on what you learned.'],
};

function StoryEditor({
  story,
  english,
  isNew,
  onSave,
  onDelete,
  onClose,
}: {
  story: Story;
  english: boolean;
  isNew: boolean;
  onSave: (story: Story) => Promise<Story>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const t = useT();
  const [form, setForm] = useState(story);
  const [saved, setSaved] = useState(story);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState('');
  const dirty = storyBody(form) !== storyBody(saved);
  const set = (patch: Partial<Story>) => {
    setForm((f) => ({ ...f, ...patch }));
    setState('idle');
  };
  const counts = Object.fromEntries(STAR.map((f) => [f, wordCount(form[f])])) as Record<(typeof STAR)[number], number>;
  const total = STAR.reduce((sum, f) => sum + counts[f], 0);
  const actionShare = total ? Math.round((counts.action / total) * 100) : 0;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState('saving');
    setError('');
    try {
      const next = await onSave(form);
      setSaved(next);
      setState('saved');
    } catch (e) {
      setError((e as Error).message);
      setState('idle');
    }
  }
  const close = () => {
    if (dirty && !confirm(t('有没保存的修改，确定关闭吗？', 'You have unsaved changes. Close anyway?'))) return;
    onClose();
  };
  const groups = [
    [t('常见主题', 'Common themes'), COMPETENCIES.filter((c) => !c.lp)],
    ['Amazon Leadership Principles', COMPETENCIES.filter((c) => c.lp)],
  ] as const;
  return (
    <form id="ip-editor" className="rd-card ip-editor" onSubmit={submit} aria-labelledby="ip-editor-h">
      <header className="ip-editor-head">
        <h2 id="ip-editor-h">{isNew ? t('新故事', 'New story') : t('编辑故事', 'Edit story')}</h2>
        <button type="button" className="ip-icon" onClick={close} aria-label={t('关闭编辑器', 'Close the editor')}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <label className="ip-field">
        <span>{t('标题', 'Title')}</span>
        <input
          required
          maxLength={120}
          autoFocus={isNew}
          value={form.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder={t('例如：上线前一周推翻缓存方案', 'e.g. Reworking the cache a week before launch')}
        />
      </label>
      <div className="ip-star-grid">
        {STAR.map((f) => (
          <label key={f} className="ip-field" data-field={f}>
            <span>
              <b>{f[0].toUpperCase()}</b> {STAR_NAMES[f][english ? 1 : 0]}
              <small className="ip-count">{t(`${counts[f]} 词`, `${counts[f]} words`)}</small>
            </span>
            <textarea rows={f === 'action' ? 7 : 4} value={form[f]} onChange={(e) => set({ [f]: e.target.value } as Partial<Story>)} />
            <small className="ip-guide">{t(...GUIDE[f])}</small>
          </label>
        ))}
      </div>
      <p className="ip-length" aria-live="polite">
        {t(
          `共 ${total} 词 · 讲出来约 ${minutes(speakingSeconds(total))} · 建议 1.5 到 3 分钟`,
          `${total} words · about ${minutes(speakingSeconds(total))} spoken · aim for 1.5 to 3 minutes`,
        )}
        {total >= 60 && actionShare < 40 && (
          <span className="ip-warn-text">
            {' '}
            {t(`行动只占 ${actionShare}%，多讲你本人做了什么。`, `Action is only ${actionShare}%: say more about what you did.`)}
          </span>
        )}
      </p>
      {groups.map(([legend, list]) => (
        <fieldset key={legend} className="ip-chips">
          <legend>{legend}</legend>
          {list.map((c) => (
            <label key={c.id} className="ip-chip">
              <input
                type="checkbox"
                checked={form.competencies.includes(c.id)}
                onChange={(e) =>
                  set({
                    competencies: e.target.checked
                      ? [...form.competencies, c.id]
                      : form.competencies.filter((x) => x !== c.id),
                  })
                }
              />
              {c.name[english ? 1 : 0]}
            </label>
          ))}
        </fieldset>
      ))}
      {!!form.questions.length && (
        <section className="ip-answers" aria-labelledby="ip-answers-h">
          <h3 id="ip-answers-h">{t('准备用它回答', 'Planned answer to')}</h3>
          <ul>
            {form.questions.map((q) => {
              const [type, slug] = q.key.split('/');
              return (
                <li key={q.key}>
                  <a href={`/?${new URLSearchParams({ view: 'content', type, slug })}`} target="_blank" rel="noopener">
                    {q.title}
                  </a>
                  {q.company && <span className="ip-muted"> · {q.company}</span>}
                  <button
                    type="button"
                    className="ip-icon"
                    aria-label={t(`不再用于：${q.title}`, `Unlink: ${q.title}`)}
                    onClick={() => set({ questions: form.questions.filter((x) => x.key !== q.key) })}
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <footer className="ip-editor-foot">
        <button type="submit" className="rd-button" disabled={state === 'saving' || (!dirty && !isNew)}>
          {state === 'saving' ? t('正在保存…', 'Saving…') : t('保存', 'Save')}
        </button>
        <button type="button" className="rd-button is-quiet" onClick={close}>
          {t('关闭', 'Close')}
        </button>
        <span className="ip-editor-state" role="status">
          {state === 'saved' && !dirty ? t('已保存', 'Saved') : ''}
        </span>
        {!isNew && (
          <button
            type="button"
            className="rd-button is-quiet ip-delete"
            onClick={() => {
              if (!confirm(t('删除这个故事？删除后不能恢复。', 'Delete this story? This cannot be undone.'))) return;
              onDelete(story.id).catch((e: Error) => setError(e.message));
            }}
          >
            <Trash2 size={14} aria-hidden="true" /> {t('删除', 'Delete')}
          </button>
        )}
      </footer>
      {error && (
        <p className="ip-warn" role="alert">
          {t('没能保存：', "Couldn't save: ")}
          {error}
        </p>
      )}
    </form>
  );
}
