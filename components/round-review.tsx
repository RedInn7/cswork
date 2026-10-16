'use client';
import { useState } from 'react';
import { ClipboardCheck, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { REVIEW_CRITERIA, REVIEW_NOTES_CHARS, reviewTurns, type ReviewMode, type RoundReview } from '@/lib/ai-coding';
import { useLocale, useT } from '@/lib/i18n';
import { ojRequest } from '@/lib/oj-client';

type Turn = { role: 'user' | 'assistant'; text: string };

/**
 * The round review (POST oj/ai/round-review) and its score card. 'pair' sends the AI pair
 * conversation (its newest turns within the caps) with the files; 'quality' sends a take-home's
 * files and design note. Nothing is kept: the card lasts as long as the page.
 */
export function RoundReviewCard({
  task,
  mode,
  files,
  turns = [],
  notes = '',
}: {
  task: string;
  mode: ReviewMode;
  files: Record<string, string>;
  turns?: Turn[];
  notes?: string;
}) {
  const t = useT();
  const locale = useLocale();
  const [review, setReview] = useState<RoundReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [left, setLeft] = useState<number | null>(null);
  const labels = new Map<string, string>(REVIEW_CRITERIA[mode].map(([key, zh, en]) => [key, t(zh, en)]));
  const id = `ai-round-review-${mode}`;

  async function start() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const reply = await ojRequest<{ review: RoundReview; remaining: number; bonus?: number }>('ai/round-review', {
        task,
        mode,
        files,
        turns: mode === 'pair' ? reviewTurns(turns) : [],
        notes: mode === 'quality' ? notes.slice(0, REVIEW_NOTES_CHARS) : '',
        locale,
      });
      setReview(reply.review);
      setLeft(reply.remaining + (reply.bonus ?? 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ai-round-review" aria-labelledby={id}>
      <div className="ai-round-review-head">
        <h3 id={id}>{mode === 'pair' ? t('结对评估', 'Pair review') : t('代码质量评估', 'Code quality review')}</h3>
        <Button size="sm" variant="outline" disabled={busy} onClick={start}>
          {busy ? <LoaderCircle size={14} className="cs-spin" /> : <ClipboardCheck size={14} />}
          {mode === 'pair' ? t('结束并评估', 'Finish and review') : t('评估代码质量', 'Review code quality')}
        </Button>
      </div>
      <p className="ai-round-hint">
        {mode === 'pair'
          ? t(
              '像面试官一样看你怎么用 AI：拆解任务、提问是否具体、有没有核验 AI 的输出、测试意识、能否讲清最终代码，各 1–4 分。',
              'Feedback the way an interviewer would give it: breaking the task down, specific prompts, checking AI output, testing and explaining the final code, each scored 1–4.',
            )
          : t(
              '按结构、测试、错误处理和设计说明四项打分（1–4），读的是你当前的文件、上次运行结果和设计说明。',
              'Scores structure, tests, error handling and the design note from 1 to 4, reading your current files, the last run and your note.',
            )}
        {left !== null && t(` 今天还剩 ${left} 次。`, ` ${left} left today.`)}
      </p>
      <output className="sr-only">{busy ? t('AI 正在评估', 'The AI is reviewing') : ''}</output>
      {review && (
        <>
          <dl className="ai-round-scores">
            {review.scores.map((s) => (
              <div key={s.key}>
                <dt>
                  {labels.get(s.key) ?? s.key}
                  <strong data-score={s.score}>
                    {s.score}
                    <span aria-hidden="true">/4</span>
                    <span className="sr-only">{t('（满分 4）', ' out of 4')}</span>
                  </strong>
                </dt>
                <dd>{s.why}</dd>
              </div>
            ))}
          </dl>
          {review.summary && <p className="ai-round-review-summary">{review.summary}</p>}
          {review.suggestions.length > 0 && (
            <>
              <h4>{t('下次可以这样做', 'What to try next time')}</h4>
              <ol className="ai-round-suggestions">
                {review.suggestions.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </>
          )}
        </>
      )}
      {error && (
        <p className="ai-round-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
