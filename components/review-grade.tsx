'use client';
import { useState } from 'react';
import { englishMessage } from '@/lib/messages-en';
import { hintUnlocked, ojRequest, type OJSubmission } from '@/lib/oj-client';
import type { ReviewGrade as Grade } from '@/lib/practice-review';
import type { Activity } from '@/lib/practice-stats';
import { Button } from './ui/button';
import '@/app/review-load.css';

const GRADES: [Grade, string, string][] = [
  [1, '重来', 'Again'],
  [2, '困难', 'Hard'],
  [3, '良好', 'Good'],
  [4, '简单', 'Easy'],
];

/**
 * The Accepted dialog's self-grade on a review: shown only when this problem has an AC on an
 * earlier local day (the recent submissions and the bootstrap's AC activity). The grade sets
 * when it comes back (lib/practice-review.ts reviewState); none counts as Good, and pressing
 * another replaces it. Hard is suggested after a failed submission earlier today, else Good.
 * The dialog is never shown in a contest, mock OA or exam, and the server refuses one then too.
 */
export function ReviewGrade({
  problemId,
  submission,
  history,
  activity,
  english,
}: {
  problemId: string;
  submission: Pick<OJSubmission, 'id' | 'created_at'>;
  history: Pick<OJSubmission, 'mode' | 'status' | 'created_at'>[];
  activity?: Activity[];
  english: boolean;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [saved, setSaved] = useState<Grade | null>(null);
  const [state, setState] = useState<{ busy?: boolean; error?: string }>({});
  const day = new Date(submission.created_at).toDateString();
  const earlier = (at: number) => at < submission.created_at && new Date(at).toDateString() !== day;
  const review =
    activity?.some((a) => a.problem_id === problemId && earlier(a.created_at)) ||
    history.some((s) => s.mode === 'judge' && s.status === 'accepted' && earlier(s.created_at));
  if (!review) return null;
  // hintUnlocked: a formal submission that failed on the learner's code.
  const suggested = hintUnlocked(
    history.filter((s) => s.created_at < submission.created_at && new Date(s.created_at).toDateString() === day),
  )
    ? 2
    : 3;
  async function grade(value: Grade) {
    setState({ busy: true });
    try {
      await ojRequest(`problems/${encodeURIComponent(problemId)}/aids`, {
        kind: 'grade',
        grade: value,
        submissionId: submission.id,
      });
      setSaved(value);
      setState({});
      window.dispatchEvent(new Event('cswork:practice-progress-changed'));
    } catch (error) {
      const message = (error as Error).message;
      setState({ error: english ? englishMessage(message) : message });
    }
  }
  const lit = saved ?? suggested;
  return (
    <fieldset className="cs-review-grade">
      <legend>{t('这是一次复习，这次做得怎么样？', 'A review. How did this one go?')}</legend>
      <div className="cs-review-grade-buttons">
        {GRADES.map(([value, zh, en]) => (
          <Button
            key={value}
            size="sm"
            variant={value === lit ? 'default' : 'outline'}
            aria-pressed={saved === value}
            disabled={state.busy}
            onClick={() => void grade(value)}
          >
            {t(zh, en)}
          </Button>
        ))}
      </div>
      <p className="cs-review-grade-note" aria-live="polite">
        {state.error ??
          (saved
            ? t(
                `已记为「${GRADES[saved - 1][1]}」，可以改。`,
                `Saved as ${GRADES[saved - 1][2]}. You can change it.`,
              )
            : (suggested === 2 ? t('今天这题失败过，建议选「困难」。', 'It failed earlier today: Hard fits. ') : '') +
              t(
                '重来：明天再做；困难：间隔不变；良好：进入下一档；简单：跳一档。不评就按良好。',
                'Again: back tomorrow. Hard: same wait. Good: next step. Easy: skip a step. No grade counts as Good.',
              ))}
      </p>
    </fieldset>
  );
}
