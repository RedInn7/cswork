'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LoaderCircle, MessageCircleQuestion, ScanSearch } from 'lucide-react';
import { StatementMarkdown } from './statement-markdown';
import { ojRequest } from '@/lib/oj-client';
import { englishMessage } from '@/lib/messages-en';
import type { Language } from '@/lib/problems';
import type { CodingMode } from '@/lib/coding-mode';
import '@/app/ai-tutor.css';

type Kind = 'hint' | 'review';
type Reply = { id: number; kind: Kind; text: string };
type Answer = { kind: Kind; text: string; remaining: number; limit: number };

/**
 * The tutor's memory, kept by the workspace like the hint ladder's: switching tabs unmounts
 * the panel, and the replies must survive that. Only the last three hints go back with the
 * next request, so the tutor builds on them instead of repeating itself.
 */
export function useAiTutor(problemId: string) {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState('');
  // Calls left today, from the server; unknown (no number shown) until it answers.
  const [left, setLeft] = useState<Record<Kind, number | null>>({ hint: null, review: null });
  const next = useRef(0);
  const loaded = useRef(false);
  const load = useCallback(() => {
    if (loaded.current) return;
    loaded.current = true;
    ojRequest<Record<Kind, number>>('ai/usage').then(
      // A call that answered first already knows better.
      (fresh) => setLeft((counts) => ({ hint: counts.hint ?? fresh.hint, review: counts.review ?? fresh.review })),
      () => {},
    );
  }, []);
  const ask = useCallback(
    async (
      kind: Kind,
      context: { language: Language; codingMode: CodingMode; code: string; english: boolean },
    ) => {
      setBusy(kind);
      setError('');
      try {
        const answer = await ojRequest<Answer>(`ai/${kind}`, {
          problemId,
          language: context.language,
          codingMode: context.codingMode,
          code: context.code,
          locale: context.english ? 'en' : 'zh',
          previous: replies
            .filter((r) => r.kind === 'hint')
            .slice(-3)
            .map((r) => r.text),
        });
        setReplies((list) => [...list, { id: ++next.current, kind, text: answer.text }]);
        setLeft((counts) => ({ ...counts, [kind]: answer.remaining }));
      } catch (caught) {
        const failure = caught as Error & { status?: number | string };
        const message =
          failure.status === 'timeout'
            ? context.english
              ? 'The AI tutor took too long. Please try again'
              : 'AI 助教响应超时，请稍后再试'
            : failure.message;
        setError(context.english ? englishMessage(message) : message);
        // Out of today's quota: say so on the button too.
        if (failure.status === 429) setLeft((counts) => ({ ...counts, [kind]: 0 }));
      } finally {
        setBusy(null);
      }
    },
    [problemId, replies],
  );
  return { replies, busy, error, left, ask, load };
}

/**
 * AI hints (Socratic, never code) and an AI code review on the problem page. The workspace
 * shows it only when the server has AI configured, for a signed-in learner, outside a mock OA.
 */
export function AiTutor({
  tutor: { replies, busy, error, left, ask, load },
  language,
  codingMode,
  code,
  english,
  accepted,
}: {
  tutor: ReturnType<typeof useAiTutor>;
  language: Language;
  codingMode: CodingMode;
  code: string;
  english: boolean;
  /** The latest formal submission was accepted: the review is the natural next step. */
  accepted: boolean;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const context = { language, codingMode, code, english };
  const hints = replies.filter((r) => r.kind === 'hint').length;
  useEffect(load, [load]);
  const count = (kind: Kind) => {
    const n = left[kind];
    if (n === null) return null;
    return <span className="cs-ai-tutor-count">{english ? `${n} left today` : `今天还剩 ${n} 次`}</span>;
  };
  return (
    <section
      className="cs-ai-tutor"
      aria-labelledby="ai-tutor-title"
      aria-busy={busy !== null}
      data-accepted={accepted || undefined}
    >
      <header className="cs-ai-tutor-head">
        <strong id="ai-tutor-title">{t('AI 助教', 'AI tutor')}</strong>
        <span className="cs-ai-tutor-badge">Beta</span>
        <p>
          {t(
            '提示只给方向、不给代码；点评讲复杂度、边界情况和代码风格。你的代码、题面和最近一次判题结果会发送给 Anthropic 生成回复，不含邮箱和姓名。AI 也会出错。',
            'Hints point the way without code; reviews cover complexity, edge cases and style. Your code, the problem and your last verdict are sent to Anthropic to write the reply, never your email or name. AI can be wrong.',
          )}
        </p>
      </header>
      {accepted && (
        <p className="cs-ai-tutor-nudge">
          {t(
            '已通过。让 AI 像面试官一样复盘一下这份代码？',
            'Accepted. Want the AI to debrief this code the way an interviewer would?',
          )}
        </p>
      )}
      {/* Always mounted, so a screen reader announces the first reply too. */}
      <div aria-live="polite">
        {replies.length > 0 && (
          <ol className="cs-ai-tutor-replies">
            {replies.map((reply) => {
              const n = replies.filter((r) => r.kind === 'hint' && r.id <= reply.id).length;
              return (
                <li key={reply.id} data-kind={reply.kind}>
                  <span className="cs-ai-tutor-label">
                    {reply.kind === 'hint'
                      ? t(`提示 ${n}`, `Hint ${n}`)
                      : t('代码点评', 'Code review')}
                  </span>
                  <StatementMarkdown body={reply.text} className="cs-statement-markdown cs-ai-tutor-text" plain />
                </li>
              );
            })}
          </ol>
        )}
      </div>
      {error && (
        <p className="cs-ai-tutor-error" role="alert">
          {error}
        </p>
      )}
      <div className="cs-ai-tutor-actions">
        <button
          type="button"
          disabled={busy !== null || left.hint === 0}
          onClick={() => void ask('hint', context)}
        >
          {busy === 'hint' ? (
            <LoaderCircle size={14} className="cs-ai-tutor-spin" aria-hidden="true" />
          ) : (
            <MessageCircleQuestion size={14} aria-hidden="true" />
          )}
          {busy === 'hint'
            ? t('正在想…', 'Thinking…')
            : hints
              ? t('再给一个提示', 'Another hint')
              : t('给我一个提示', 'Give me a hint')}
          {count('hint')}
        </button>
        <button
          type="button"
          data-primary={accepted || undefined}
          disabled={busy !== null || left.review === 0 || !code.trim()}
          onClick={() => void ask('review', context)}
        >
          {busy === 'review' ? (
            <LoaderCircle size={14} className="cs-ai-tutor-spin" aria-hidden="true" />
          ) : (
            <ScanSearch size={14} aria-hidden="true" />
          )}
          {busy === 'review'
            ? t('正在点评…', 'Reviewing…')
            : accepted
              ? t('点评这份通过的代码', 'Review my accepted code')
              : t('点评我的代码', 'Review my code')}
          {count('review')}
        </button>
      </div>
    </section>
  );
}
