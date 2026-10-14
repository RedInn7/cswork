'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  Bug,
  Check,
  FlaskConical,
  Gauge,
  LoaderCircle,
  MessageCircleQuestion,
  Plus,
  ScanSearch,
  SendHorizontal,
  TextQuote,
} from 'lucide-react';
import { StatementMarkdown } from './statement-markdown';
import { ojRequest } from '@/lib/oj-client';
import { englishMessage } from '@/lib/messages-en';
import type { Language } from '@/lib/problems';
import type { CodingMode } from '@/lib/coding-mode';
import '@/app/ai-tutor.css';

export type AiKind = 'hint' | 'review' | 'chat' | 'tests' | 'debug' | 'complexity' | 'explain';
const KINDS: AiKind[] = ['hint', 'review', 'chat', 'tests', 'debug', 'complexity', 'explain'];
type Reply = { id: number; kind: AiKind; text: string; mine?: boolean; quote?: string };
export type CaseIdea = { input: string; why: string };
type Answer = { kind: AiKind; text?: string; cases?: CaseIdea[]; remaining: number; limit: number };
export type AiContext = { language: Language; codingMode: CodingMode; code: string; english: boolean };
// The server's caps (lib/server/ai-tutor.ts): the question, the selection, eight rounds back.
const QUESTION_MAX = 1000;
const SELECTION_MAX = 600;
const HISTORY_TURNS = 16;

/**
 * The tutor's memory, kept by the workspace like the hint ladder's: switching tabs unmounts
 * the panel, and the replies must survive that. Only the last three hints go back with the
 * next hint, and the last eight question-and-answer rounds with the next question.
 */
export function useAiTutor(problemId: string) {
  const [replies, setReplies] = useState<Reply[]>([]);
  // Edge-case ideas live in the console, not the thread.
  const [ideas, setIdeas] = useState<CaseIdea[] | null>(null);
  const [busy, setBusy] = useState<AiKind | null>(null);
  // Which surface asked: the thread, the console (tests) or the AC dialog (complexity).
  const [error, setError] = useState<{ kind: AiKind; message: string } | null>(null);
  // Calls left today, from the server; unknown (no number shown) until it answers.
  const [left, setLeft] = useState<Record<AiKind, number | null>>(
    () => Object.fromEntries(KINDS.map((k) => [k, null])) as Record<AiKind, number | null>,
  );
  const next = useRef(0);
  const loaded = useRef(false);
  const load = useCallback(() => {
    if (loaded.current) return;
    loaded.current = true;
    ojRequest<Partial<Record<AiKind, number>>>('ai/usage').then(
      // A call that answered first already knows better.
      (fresh) =>
        setLeft(
          (counts) =>
            Object.fromEntries(KINDS.map((k) => [k, counts[k] ?? fresh[k] ?? null])) as Record<
              AiKind,
              number | null
            >,
        ),
      () => {},
    );
  }, []);
  const ask = useCallback(
    async (kind: AiKind, context: AiContext, extra: { question?: string; selection?: string } = {}) => {
      setBusy(kind);
      setError(null);
      try {
        const answer = await ojRequest<Answer>(`ai/${kind}`, {
          problemId,
          language: context.language,
          codingMode: context.codingMode,
          // An explanation is about the statement: the code stays in the browser.
          code: kind === 'explain' ? '' : context.code,
          locale: context.english ? 'en' : 'zh',
          previous: replies
            .filter((r) => r.kind === 'hint')
            .slice(-3)
            .map((r) => r.text),
          ...(kind === 'chat' && {
            question: extra.question,
            history: replies
              .filter((r) => r.kind === 'chat')
              .slice(-HISTORY_TURNS)
              .map((r) => ({ role: r.mine ? 'user' : 'assistant', text: r.text })),
          }),
          ...(kind === 'explain' && { selection: extra.selection }),
        });
        if (kind === 'tests') setIdeas(answer.cases ?? []);
        else
          setReplies((list) => [
            ...list,
            ...(kind === 'chat' && extra.question
              ? [{ id: ++next.current, kind, text: extra.question, mine: true }]
              : []),
            { id: ++next.current, kind, text: answer.text ?? '', quote: extra.selection },
          ]);
        setLeft((counts) => ({ ...counts, [kind]: answer.remaining }));
        return true;
      } catch (caught) {
        const failure = caught as Error & { status?: number | string };
        const message =
          failure.status === 'timeout'
            ? context.english
              ? 'The AI tutor took too long. Please try again'
              : 'AI 助教响应超时，请稍后再试'
            : failure.message;
        setError({ kind, message: context.english ? englishMessage(message) : message });
        // Out of today's quota: say so on the button too.
        if (failure.status === 429) setLeft((counts) => ({ ...counts, [kind]: 0 }));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [problemId, replies],
  );
  return { replies, ideas, busy, error, left, ask, load };
}
type Tutor = ReturnType<typeof useAiTutor>;

const Spin = () => <LoaderCircle size={14} className="cs-ai-tutor-spin" aria-hidden="true" />;
function Count({ tutor, kind, english }: { tutor: Tutor; kind: AiKind; english: boolean }) {
  const n = tutor.left[kind];
  if (n === null) return null;
  return <span className="cs-ai-tutor-count">{english ? `${n} left today` : `今天还剩 ${n} 次`}</span>;
}
const Failure = ({ tutor, kinds }: { tutor: Tutor; kinds: AiKind[] }) =>
  tutor.error && kinds.includes(tutor.error.kind) ? (
    <p className="cs-ai-tutor-error" role="alert">
      {tutor.error.message}
    </p>
  ) : null;

/**
 * The tutor thread on the problem page: hints (Socratic, never code), a code review, free
 * questions, a look at the last failure, and explanations asked from a statement selection
 * (AskAiSelection). The workspace shows it only when the server has AI configured, for a
 * signed-in learner, outside a mock OA.
 */
export function AiTutor({
  tutor,
  language,
  codingMode,
  code,
  english,
  accepted,
  failed = false,
}: {
  tutor: Tutor;
  language: Language;
  codingMode: CodingMode;
  code: string;
  english: boolean;
  /** The latest formal submission was accepted: the review is the natural next step. */
  accepted: boolean;
  /** The latest run or submission failed: "why did it fail" is on offer. */
  failed?: boolean;
}) {
  const { replies, busy, left, ask, load } = tutor;
  const t = (zh: string, en: string) => (english ? en : zh);
  const context = { language, codingMode, code, english };
  const hints = replies.filter((r) => r.kind === 'hint').length;
  const [question, setQuestion] = useState('');
  useEffect(load, [load]);
  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = question.trim();
    if (!text || busy) return;
    if (await ask('chat', context, { question: text })) setQuestion('');
  };
  const label = (reply: Reply) => {
    const n = replies.filter((r) => r.kind === 'hint' && r.id <= reply.id).length;
    return {
      hint: t(`提示 ${n}`, `Hint ${n}`),
      review: t('代码点评', 'Code review'),
      chat: reply.mine ? t('你问', 'You asked') : t('AI 回答', 'Tutor'),
      tests: '',
      debug: t('调试线索', 'Debugging lead'),
      complexity: t('复杂度', 'Complexity'),
      explain: t('解释', 'Explanation'),
    }[reply.kind];
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
            '提示、追问和调试只给方向、不给代码，通过后追问才能聊最优解；点评讲复杂度、边界情况和代码风格；选中题面文字可以让 AI 解释。你的代码、题面、最近一次判题结果（调试时还有你能看到的失败用例）和本页的对话会发送给 Anthropic 生成回复，不含邮箱和姓名。AI 也会出错。',
            "Hints, questions and debugging point the way without code; after an AC your questions can cover the best solution. Reviews cover complexity, edge cases and style, and selecting statement text asks for an explanation. Your code, the problem, your last verdict (for debugging, the failing case you can see) and this page's conversation are sent to Anthropic to write the reply, never your email or name. AI can be wrong.",
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
            {replies.map((reply) => (
              <li key={reply.id} data-kind={reply.kind} data-mine={reply.mine || undefined}>
                <span className="cs-ai-tutor-label">{label(reply)}</span>
                {reply.quote && <blockquote className="cs-ai-tutor-quote">{reply.quote}</blockquote>}
                {reply.mine ? (
                  <p className="cs-ai-tutor-text cs-ai-tutor-asked">{reply.text}</p>
                ) : (
                  <StatementMarkdown body={reply.text} className="cs-statement-markdown cs-ai-tutor-text" plain />
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
      <Failure tutor={tutor} kinds={['hint', 'review', 'chat', 'debug', 'explain']} />
      <div className="cs-ai-tutor-actions">
        <button type="button" disabled={busy !== null || left.hint === 0} onClick={() => void ask('hint', context)}>
          {busy === 'hint' ? <Spin /> : <MessageCircleQuestion size={14} aria-hidden="true" />}
          {busy === 'hint'
            ? t('正在想…', 'Thinking…')
            : hints
              ? t('再给一个提示', 'Another hint')
              : t('给我一个提示', 'Give me a hint')}
          <Count tutor={tutor} kind="hint" english={english} />
        </button>
        <button
          type="button"
          data-primary={accepted || undefined}
          disabled={busy !== null || left.review === 0 || !code.trim()}
          onClick={() => void ask('review', context)}
        >
          {busy === 'review' ? <Spin /> : <ScanSearch size={14} aria-hidden="true" />}
          {busy === 'review'
            ? t('正在点评…', 'Reviewing…')
            : accepted
              ? t('点评这份通过的代码', 'Review my accepted code')
              : t('点评我的代码', 'Review my code')}
          <Count tutor={tutor} kind="review" english={english} />
        </button>
        {failed && (
          <button
            type="button"
            disabled={busy !== null || left.debug === 0}
            onClick={() => void ask('debug', context)}
          >
            {busy === 'debug' ? <Spin /> : <Bug size={14} aria-hidden="true" />}
            {busy === 'debug' ? t('正在看…', 'Looking…') : t('帮我找失败原因', 'Why did it fail?')}
            <Count tutor={tutor} kind="debug" english={english} />
          </button>
        )}
      </div>
      <form className="cs-ai-tutor-ask" onSubmit={(event) => void send(event)}>
        <textarea
          value={question}
          maxLength={QUESTION_MAX}
          rows={2}
          readOnly={busy === 'chat'}
          aria-label={t('向 AI 助教提问', 'Ask the AI tutor')}
          placeholder={
            accepted
              ? t('已通过：可以问最优解、其他做法和取舍', 'Solved: ask about the best solution, other approaches, trade-offs')
              : t(
                  '问问这道题：概念、方向、为什么超时……（通过前不给代码和完整解法）',
                  'Ask about this problem: a concept, a direction, why it times out… (no code or full solution before you pass)',
                )
          }
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter breaks the line; never mid-IME composition.
            if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            void send();
          }}
        />
        <button
          type="submit"
          aria-label={t('发送问题', 'Send question')}
          title={t('发送问题', 'Send question')}
          disabled={busy !== null || left.chat === 0 || !question.trim()}
        >
          {busy === 'chat' ? <Spin /> : <SendHorizontal size={15} aria-hidden="true" />}
        </button>
        <Count tutor={tutor} kind="chat" english={english} />
      </form>
    </section>
  );
}

/**
 * The console's edge-case ideas: inputs in this box's format (checked on the server), each
 * one click from becoming a custom case. Never an expected output.
 */
export function AiCaseIdeas({
  tutor,
  context,
  onAdd,
}: {
  tutor: Tutor;
  context: AiContext;
  /** Adds the input as a custom case; false when there is no room. */
  onAdd: (input: string) => boolean;
}) {
  const { ideas, busy, left, ask, load } = tutor;
  const english = context.english;
  const t = (zh: string, en: string) => (english ? en : zh);
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  useEffect(load, [load]);
  return (
    <section className="cs-ai-cases" aria-label={t('AI 边界用例', 'AI edge cases')}>
      <button
        type="button"
        className="cs-ai-cases-ask"
        disabled={busy !== null || left.tests === 0}
        onClick={() => void ask('tests', context).then((ok) => ok && setAdded(new Set()))}
      >
        {busy === 'tests' ? <Spin /> : <FlaskConical size={14} aria-hidden="true" />}
        {busy === 'tests' ? t('正在想用例…', 'Thinking of cases…') : t('AI 出几个边界用例', 'Suggest edge cases')}
        <Count tutor={tutor} kind="tests" english={english} />
      </button>
      <Failure tutor={tutor} kinds={['tests']} />
      <div aria-live="polite">
        {ideas && (
          <ol className="cs-ai-cases-list">
            {ideas.map((idea) => (
              <li key={idea.input}>
                <pre>{idea.input}</pre>
                <p>{idea.why}</p>
                <button
                  type="button"
                  disabled={added.has(idea.input)}
                  onClick={() => onAdd(idea.input) && setAdded((set) => new Set(set).add(idea.input))}
                >
                  {added.has(idea.input) ? (
                    <Check size={13} aria-hidden="true" />
                  ) : (
                    <Plus size={13} aria-hidden="true" />
                  )}
                  {added.has(idea.input) ? t('已加入', 'Added') : t('加入自定义用例', 'Add to my cases')}
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

/** "Analyse complexity" in the AC dialog: time, space and the best known bound for this problem. */
export function AiComplexity({ tutor, context }: { tutor: Tutor; context: AiContext }) {
  const { replies, busy, left, ask, load } = tutor;
  const t = (zh: string, en: string) => (context.english ? en : zh);
  // Only what this dialog asked for, not an analysis from an earlier AC.
  const [since] = useState(() => replies.at(-1)?.id ?? 0);
  const answer = replies.filter((r) => r.kind === 'complexity' && r.id > since).at(-1);
  useEffect(load, [load]);
  return (
    <div className="cs-ai-complexity">
      {!answer && (
        <button
          type="button"
          disabled={busy !== null || left.complexity === 0 || !context.code.trim()}
          onClick={() => void ask('complexity', context)}
        >
          {busy === 'complexity' ? <Spin /> : <Gauge size={14} aria-hidden="true" />}
          {busy === 'complexity' ? t('正在分析…', 'Analysing…') : t('AI 分析复杂度', 'Analyse complexity')}
          <Count tutor={tutor} kind="complexity" english={context.english} />
        </button>
      )}
      <Failure tutor={tutor} kinds={['complexity']} />
      <div aria-live="polite">
        {answer && <StatementMarkdown body={answer.text} className="cs-statement-markdown cs-ai-tutor-text" plain />}
      </div>
    </div>
  );
}

/**
 * A floating "Ask AI" over a selection inside `container` (the statement): explains the
 * passage, never the solution. Portalled to the body so no transformed ancestor moves it.
 */
export function AskAiSelection({
  container,
  english,
  disabled,
  onAsk,
}: {
  container: RefObject<HTMLElement | null>;
  english: boolean;
  disabled: boolean;
  onAsk: (text: string) => void;
}) {
  const [spot, setSpot] = useState<{ text: string; top: number; left: number } | null>(null);
  useEffect(() => {
    const update = () => {
      const selection = document.getSelection();
      const root = container.current;
      const text = selection?.toString().trim() ?? '';
      const inside =
        !!root && !!selection?.anchorNode && root.contains(selection.anchorNode) && root.contains(selection.focusNode);
      const rect =
        inside && text && text.length <= SELECTION_MAX && selection!.rangeCount
          ? selection!.getRangeAt(0).getBoundingClientRect?.()
          : null;
      setSpot(rect ? { text, top: rect.top, left: rect.left + rect.width / 2 } : null);
    };
    document.addEventListener('selectionchange', update);
    window.addEventListener('scroll', update, true);
    return () => {
      document.removeEventListener('selectionchange', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [container]);
  if (!spot || disabled) return null;
  return createPortal(
    <button
      type="button"
      className="cs-ai-ask-selection"
      style={{ top: Math.max(8, spot.top - 40), left: spot.left }}
      // Keep the selection while the button takes the click.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        onAsk(spot.text);
        document.getSelection()?.removeAllRanges();
        setSpot(null);
      }}
    >
      <TextQuote size={14} aria-hidden="true" />
      {english ? 'Ask AI to explain' : '问 AI：这段什么意思'}
    </button>,
    document.body,
  );
}
