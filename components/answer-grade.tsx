'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useLocale, useT } from '@/lib/i18n';
import { ojRequest } from '@/lib/oj-client';
import type { AnswerFeedback } from '@/lib/server/ai-answer';

// Mirrors lib/server/ai-answer.ts; the server checks again.
export const GRADE_MIN = 80;
/** What TryFirst targets the server grades: library questions and system design cases. */
export const GRADEABLE = /^(?:content:(?:interview|coding)_question\/|sd:)/;
const SCORES: [zh: string, en: string][] = [
  ['偏题或错得多', 'Off the mark'],
  ['方向对，漏点多', 'On topic, big gaps'],
  ['大部分到位', 'Mostly there'],
  ['完整清晰', 'Interview-ready'],
];
type Reply = { feedback: AnswerFeedback; remaining: number; bonus?: number };
/** Feedback left today; `ai/usage` answers 404 when AI is off. */
const remaining = () =>
  ojRequest<Record<string, number>>('ai/usage').then((usage) => (usage.grade ?? 0) + (usage.bonus ?? 0));

/**
 * "AI feedback on my answer" (lib/server/ai-answer.ts) for a signed-in learner. Hidden until the
 * answer is long enough (`ready`) and the server says AI is on: `ai/usage` is asked once, then,
 * and answers 404 without a key. `request` builds the body at click time. The feedback stays in
 * this component, nothing is saved.
 */
export function AnswerGrade({ ready, request }: { ready: boolean; request: () => object }) {
  const t = useT();
  const locale = useLocale();
  const id = useId();
  const [left, setLeft] = useState<number | null | 'off'>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const asked = useRef(false);
  const result = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!ready || asked.current) return;
    asked.current = true;
    remaining().then(setLeft, () => setLeft('off'));
  }, [ready]);
  // A new review takes focus, so a screen reader starts reading it.
  useEffect(() => {
    if (feedback) result.current?.focus();
  }, [feedback]);
  async function grade() {
    setBusy(true);
    setError('');
    try {
      const reply = await ojRequest<Reply>('ai/grade', { ...request(), locale });
      setFeedback(reply.feedback);
      setLeft(reply.remaining + (reply.bonus ?? 0));
    } catch (e) {
      const failure = e as Error & { status?: number | string };
      setError(failure.message);
      // The day's quota, or the AI routes' shared per-minute limit: ask which.
      if (failure.status === 429) remaining().then(setLeft, () => setLeft(0));
    } finally {
      setBusy(false);
    }
  }
  if ((!ready && !feedback) || left === null || left === 'off') return null;
  return (
    <div className="ip-grade">
      <div className="ip-grade-go">
        <button type="button" className="rd-button is-quiet" disabled={busy || !ready || left === 0} onClick={() => void grade()}>
          <Sparkles size={14} aria-hidden="true" />{' '}
          {busy ? t('正在点评…（约 20 秒）', 'Reviewing… (about 20 seconds)') : t('AI 点评我的答案', 'AI feedback on my answer')}
        </button>
        <small aria-live="polite">
          {left > 0
            ? t(`今天还可以点评 ${left} 次`, `${left} left today`)
            : t('今天的次数已用完，明天再来', "You've used today's feedback. Come back tomorrow")}
        </small>
      </div>
      {error && (
        <p className="ip-warn" role="alert">
          {error}
        </p>
      )}
      {feedback && (
        <section className="ip-grade-result" ref={result} tabIndex={-1} aria-labelledby={`${id}-h`}>
          <h3 id={`${id}-h`}>
            {t('AI 点评', 'AI feedback')}{' '}
            <span className="ip-grade-score" data-score={feedback.score}>
              {feedback.score}/4 · {t(...SCORES[feedback.score - 1])}
            </span>
          </h3>
          {!!feedback.covered.length && (
            <div>
              <h4>{t('答到的点', 'Covered')}</h4>
              <ul data-kind="covered">
                {feedback.covered.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {!!feedback.missing.length && (
            <div>
              <h4>{t('漏掉或答错的点', 'Missing or wrong')}</h4>
              <ul data-kind="missing">
                {feedback.missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {feedback.tighter && (
            <div>
              <h4>{t('更紧凑的版本', 'A tighter version')}</h4>
              <blockquote className="ip-grade-tighter">{feedback.tighter}</blockquote>
            </div>
          )}
          <p className="ip-muted">
            {t(
              'AI 点评可能有错，以参考答案为准；方括号里的 [X%] 是占位符，只填你能证实的数字。',
              'AI feedback can be wrong; the reference answer has the last word. Brackets such as [X%] are placeholders: fill in only numbers you can back up.',
            )}
          </p>
        </section>
      )}
    </div>
  );
}
