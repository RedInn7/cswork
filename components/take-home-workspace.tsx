'use client';
import { useEffect, useState } from 'react';
import { Countdown } from '@/components/countdown';
import { ProjectWorkspace } from '@/components/project-workspace';
import { RoundReviewCard } from '@/components/round-review';
import { REVIEW_NOTES_CHARS } from '@/lib/ai-coding';
import { useT } from '@/lib/i18n';
import { activeStatuses } from '@/lib/oj-client';

const notesKey = (slug: string) => `cswork:take-home:${slug}:notes`;

/**
 * A take-home assignment (/take-home/<slug>): a timer kept in this browser, the project workspace
 * without the AI pair, the learner's design note (kept in this browser too) and, once a run has
 * finished, the AI code quality review (mode 'quality').
 */
export function TakeHomeWorkspace({
  slug,
  minutes,
  files,
  hiddenTotal,
  signedIn,
  verified,
  ai,
}: {
  slug: string;
  minutes: number;
  files: Record<string, string>;
  hiddenTotal: number;
  signedIn: boolean;
  verified: boolean;
  /** The quality review is on (the server has an AI key). */
  ai: boolean;
}) {
  const t = useT();
  // null until read from storage, so the empty first render never overwrites a saved note.
  const [notes, setNotes] = useState<string | null>(null);

  useEffect(() => {
    let saved = '';
    try {
      saved = localStorage.getItem(notesKey(slug)) ?? '';
    } catch {
      /* Blocked storage: the note lasts this visit. */
    }
    // oxlint-disable-next-line react/react-compiler -- Hydrate from browser storage after SSR.
    setNotes(saved);
  }, [slug]);
  useEffect(() => {
    if (notes === null) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(notesKey(slug), notes);
      } catch {
        /* This visit still has it. */
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [slug, notes]);

  return (
    <div className="ica-bench">
      <div className="ica-bar">
        <p className="ai-round-hint">
          {t(
            '不可用 AI。计时、设计说明和编辑中的代码只保存在这个浏览器里；运行测试时文件会和 AI 辅助轮一样保存在你的运行记录里。',
            'No AI. The timer, the design note and the code you are editing stay in this browser; a test run keeps the files in your run records, as in the AI-assisted round.',
          )}
        </p>
        <Countdown storageKey={`cswork:take-home:${slug}:started`} minutes={minutes} />
      </div>
      <ProjectWorkspace
        task={slug}
        files={files}
        hiddenTotal={hiddenTotal}
        signedIn={signedIn}
        verified={verified}
        ai={false}
        aiLimit={0}
        pair={false}
        aside={(current, run) => (
          <section className="ai-round-notes" aria-labelledby="take-home-notes-title">
            <h2 id="take-home-notes-title">{t('设计说明', 'Design note')}</h2>
            <label htmlFor="take-home-notes" className="ai-round-hint">
              {t(
                '怎么运行、做了哪些假设、有哪些取舍、上线前还要改什么。',
                'How to run it, your assumptions, the trade-offs and what you would change before production.',
              )}
            </label>
            <textarea
              id="take-home-notes"
              value={notes ?? ''}
              maxLength={REVIEW_NOTES_CHARS}
              aria-describedby="take-home-notes-count"
              onChange={(event) => setNotes(event.target.value)}
            />
            <small id="take-home-notes-count">
              {(notes ?? '').length} / {REVIEW_NOTES_CHARS}
            </small>
            {ai &&
              signedIn &&
              (run && !activeStatuses.has(run.status) ? (
                <RoundReviewCard task={slug} mode="quality" files={current} notes={notes ?? ''} />
              ) : (
                <p className="ai-round-hint">
                  {t('跑完一次测试后，可以请 AI 评估代码质量。', 'Once a test run has finished you can ask for an AI review of the code quality.')}
                </p>
              ))}
          </section>
        )}
      />
    </div>
  );
}
