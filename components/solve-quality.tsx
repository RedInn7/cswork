'use client';
import { solveQuality, type PracticeHistoryItem } from '@/lib/practice-review';
import '@/app/learner-cloud.css';

const LEVEL_EN: Record<string, string> = { 简单: 'Easy', 中等: 'Medium', 困难: 'Hard' };

/**
 * The progress page's solve quality: the share of solves made without help and on the first try,
 * and the median timed first solve per difficulty against its interview budget. Nothing until a solve.
 */
export function SolveQuality({
  history,
  difficultyOf,
  english,
}: {
  history: PracticeHistoryItem[];
  difficultyOf: (problemId: string) => string | undefined;
  english: boolean;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const q = solveQuality(history, difficultyOf);
  if (!q.solved) return null;
  const pct = (n: number) => `${Math.round((n / q.solved) * 100)}%`;
  const minutes = (seconds: number) => Math.max(1, Math.round(seconds / 60));
  return (
    <section className="cloud-mocks" aria-labelledby="solve-quality-title">
      <div className="cloud-head">
        <h2 id="solve-quality-title">{t('做题质量', 'How you solve')}</h2>
        <p>
          {t('独立通过率 ', 'Solved on your own ')}
          <b>{pct(q.independent)}</b>
          {t(`（${q.independent}/${q.solved} 道）`, ` (${q.independent} of ${q.solved})`)}
          {t(' · 一次通过率 ', ' · First-try AC ')}
          <b>{pct(q.firstTry)}</b>
        </p>
        {(q.wbTried > 0 || q.brute > 0) && (
          <p>
            {q.wbTried > 0 &&
              t(
                `白板一次通过率 ${Math.round((q.wbPassed / q.wbTried) * 100)}%（${q.wbPassed}/${q.wbTried}）`,
                `Whiteboard first-try pass rate ${Math.round((q.wbPassed / q.wbTried) * 100)}% (${q.wbPassed} of ${q.wbTried})`,
              )}
            {q.wbTried > 0 && q.brute > 0 && ' · '}
            {q.brute > 0 && t(`AC 前先过对拍：${q.brute} 题`, `Stress-tested before AC: ${q.brute}`)}
          </p>
        )}
        {q.medians.length > 0 && (
          <p>
            {t('首次通过用时中位数（面试预算）：', 'Median first-solve time (interview budget): ')}
            {q.medians.map((m, i) => (
              <span key={m.difficulty}>
                {i ? ' · ' : ''}
                {t(m.difficulty, LEVEL_EN[m.difficulty])} <b>{minutes(m.seconds)}</b>
                {t(` 分钟（${m.budget / 60}）`, ` min (${m.budget / 60})`)}
                {/* Judged on the shown minutes, so "25 (25)" is never flagged over. */}
                {minutes(m.seconds) > m.budget / 60 && t('，超出预算', ', over budget')}
              </span>
            ))}
          </p>
        )}
        <p>
          {t(
            '通过前看过第 2 条起的提示、打开过题解标签页或用过 AI 助教（解释题面除外），记为借助提示通过；这类题 1 天后会先复习一次。用时取题目计时器在首次通过时的读数。',
            'A solve counts as with help when hint 2 or later, the Editorial tab or the AI tutor (other than explaining the statement) came before the first AC; those problems come back for a review after one day first. Times are the problem timer’s reading at the first AC.',
          )}
        </p>
      </div>
    </section>
  );
}
