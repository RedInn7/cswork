'use client';
import { useMemo, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { Countdown } from '@/components/countdown';
import { ProjectWorkspace, type Run } from '@/components/project-workspace';
import { StatementMarkdown } from '@/components/statement-markdown';
import { ICA_LEVELS } from '@/lib/ai-coding';
import { useLocale, useT } from '@/lib/i18n';
import { ojRequest } from '@/lib/oj-client';
import type { IcaView } from '@/lib/server/ica';

const timerKey = (slug: string) => `cswork:ica:${slug}:started`;

/**
 * An ICA set (/oa/ica/<slug>): the level bar (passed, open, locked), the open level's statement, a
 * 90-minute timer kept in this browser, and the project workspace judging the chosen level. A level's
 * statement and public tests arrive only once it opens (GET oj/ica/<slug>).
 */
export function IcaWorkspace({
  slug,
  minutes,
  starter,
  initial,
  signedIn,
  verified,
}: {
  slug: string;
  minutes: number;
  starter: Record<string, string>;
  initial: IcaView;
  signedIn: boolean;
  verified: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [view, setView] = useState(initial);
  const [level, setLevel] = useState(initial.unlocked);
  // The last run's share of the chosen level's own hidden tests, per level.
  const [ratio, setRatio] = useState<Record<number, number>>({});

  // Starting code plus the public tests of every open level; stable until a level opens.
  const files = useMemo(() => Object.assign({}, starter, ...view.levels.map((l) => l.tests)) as Record<string, string>, [starter, view]);
  const open = view.levels[level - 1] ?? view.levels[view.levels.length - 1];
  const before = view.levels[open.level - 2]?.hiddenTotal ?? 0;
  const score = view.passed.length + (view.passed.includes(open.level) ? 0 : (ratio[open.level] ?? 0));
  async function finished(run: Run) {
    const hidden = run.project?.hidden;
    const own = open.hiddenTotal - before;
    // ponytail: the hidden suite reports one count for levels 1..n; this level's share assumes the
    // earlier levels still pass. Per-level counts would need the harness to report per file.
    if (hidden && own > 0)
      setRatio((value) => ({ ...value, [open.level]: Math.min(1, Math.max(0, (hidden.passed - before) / own)) }));
    if (run.status !== 'accepted') return;
    try {
      const next = await ojRequest<IcaView>(`ica/${encodeURIComponent(slug)}`);
      setView(next);
      if (next.unlocked > open.level && !next.passed.includes(next.unlocked)) setLevel(next.unlocked);
    } catch {
      /* The verdict still shows; a reload opens the next level. */
    }
  }

  return (
    <div className="ica-bench">
      <div className="ica-bar">
        <ol className="ica-levels" aria-label={t('关卡', 'Levels')}>
          {Array.from({ length: ICA_LEVELS }, (_, i) => {
            const n = i + 1;
            const passed = view.passed.includes(n);
            const locked = n > view.unlocked;
            return (
              <li key={n}>
                <button
                  type="button"
                  disabled={locked}
                  aria-current={n === open.level ? 'step' : undefined}
                  data-state={passed ? 'passed' : locked ? 'locked' : 'open'}
                  title={locked ? t('通过上一关后解锁', 'Pass the previous level to unlock') : undefined}
                  onClick={() => setLevel(n)}
                >
                  {passed ? <Check size={14} aria-hidden="true" /> : locked ? <Lock size={13} aria-hidden="true" /> : null}
                  {t(`第 ${n} 关`, `Level ${n}`)}
                  <span className="sr-only">{passed ? t('（已通过）', ' (passed)') : locked ? t('（未解锁）', ' (locked)') : ''}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="ica-score">
          {t('得分', 'Score')} <strong>{score.toFixed(2).replace(/\.?0+$/, '')}</strong> / {ICA_LEVELS}
        </p>
        <Countdown storageKey={timerKey(slug)} minutes={minutes} />
      </div>
      <section className="ica-statement" aria-label={t(`第 ${open.level} 关说明`, `Level ${open.level} brief`)}>
        <StatementMarkdown body={locale === 'zh' ? open.statement.zh : open.statement.en} />
        {!signedIn && view.unlocked === 1 && (
          <p className="ai-round-hint">{t('登录后运行测试，通过一关就解锁下一关。', 'Sign in to run the tests; passing a level unlocks the next.')}</p>
        )}
      </section>
      <ProjectWorkspace
        task={`ica:${slug}`}
        level={open.level}
        files={files}
        hiddenTotal={open.hiddenTotal}
        signedIn={signedIn}
        verified={verified}
        ai={false}
        aiLimit={0}
        pair={false}
        onFinished={finished}
      />
    </div>
  );
}
