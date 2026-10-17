'use client';
import { mcqRight, type McqQuestion, type McqSection } from '@/lib/mock-oa';
import '@/app/oa-mcq.css';

const LETTERS = 'ABCDEF';
export const MCQ_SECTION_NAMES: Record<McqSection, [string, string]> = {
  cs: ['CS 基础', 'CS fundamentals'],
  'code-output': ['读代码', 'Code output'],
  quant: ['数学与逻辑', 'Quant & logic'],
};
export const MCQ_TOPIC_NAMES: Record<string, [string, string]> = {
  os: ['操作系统', 'Operating systems'],
  dbms: ['数据库', 'Databases'],
  network: ['计算机网络', 'Networking'],
  concurrency: ['并发', 'Concurrency'],
  oop: ['面向对象', 'OOP'],
  python: ['Python', 'Python'],
  java: ['Java', 'Java'],
  js: ['JavaScript', 'JavaScript'],
  probability: ['概率', 'Probability'],
  logic: ['逻辑推理', 'Logic'],
  dsa: ['数据结构与算法', 'Data structures & algorithms'],
  complexity: ['复杂度', 'Complexity'],
  cpp: ['C++', 'C++'],
  sql: ['SQL', 'SQL'],
  linux: ['Linux 命令行', 'Linux command line'],
  git: ['Git', 'Git'],
  arch: ['计算机体系结构', 'Computer architecture'],
  security: ['Web 安全', 'Web security'],
  patterns: ['设计模式', 'Design patterns'],
  web: ['Web 前端', 'Web frontend'],
};

let bank: Promise<McqQuestion[]> | null = null;
/** The question bank, fetched on first use as its own chunk (a mock without MCQs never loads it). */
export const loadMcqBank = () =>
  (bank ??= import('@/lib/content/oa-mcq.json').then(
    (m) => m.default.questions as McqQuestion[],
    (e: unknown) => {
      bank = null;
      throw e;
    },
  ));

export type McqText = McqQuestion['en'];
/**
 * One question: radios, or checkboxes when more than one choice is right. `reveal` locks it
 * and marks the answer with its explanation, after why each wrong pick is wrong when the
 * question has `whys`; `children` go under it (a submit button, say).
 */
export function McqItem({
  q,
  text,
  n,
  zh,
  picks,
  onPick,
  reveal,
  children,
}: {
  q: Pick<McqQuestion, 'id' | 'section' | 'code' | 'answer'>;
  text: McqText;
  n: number;
  zh: boolean;
  picks: readonly number[];
  onPick: (picks: number[]) => void;
  reveal: boolean;
  children?: React.ReactNode;
}) {
  const t = (a: string, b: string) => (zh ? a : b);
  const multi = q.answer.length > 1;
  const right = mcqRight(q.answer, picks);
  const letters = q.answer.map((a) => LETTERS[a]).join(zh ? '、' : ', ');
  // Missed: why each wrong pick is wrong comes before the explanation.
  const wrongPicks = reveal && text.whys ? picks.filter((j) => !q.answer.includes(j)) : [];
  return (
    <fieldset className="oa-mcq-item" aria-describedby={q.code ? `mcq-code-${q.id}` : undefined}>
      <legend>
        <span className="oa-mcq-qno" aria-hidden="true">
          Q{n}
        </span>
        {text.q}
      </legend>
      {q.code && (
        <pre className="oa-mcq-code" id={`mcq-code-${q.id}`}>
          <code>{q.code}</code>
        </pre>
      )}
      <ul className="oa-mcq-choices" data-code={q.section === 'code-output' || undefined}>
        {text.choices.map((choice, j) => {
          const on = picks.includes(j);
          const state = !reveal ? undefined : q.answer.includes(j) ? 'right' : on ? 'wrong' : undefined;
          return (
            <li key={j} data-state={state}>
              <label>
                <input
                  type={multi ? 'checkbox' : 'radio'}
                  name={`mcq-${q.id}`}
                  checked={on}
                  disabled={reveal}
                  onChange={() =>
                    onPick(multi ? (on ? picks.filter((p) => p !== j) : [...picks, j].sort((a, b) => a - b)) : [j])
                  }
                />
                <span className="oa-mcq-letter" aria-hidden="true">
                  {LETTERS[j]}
                </span>
                <span className="oa-mcq-choice">{choice}</span>
                {state && (
                  <span className="oa-mcq-mark">
                    {state === 'right' ? t('正确答案', 'Answer') : t('你的选择', 'Your pick')}
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>
      <div aria-live="polite">
        {reveal && (
          <p className="oa-mcq-why" data-state={right ? 'right' : 'wrong'}>
            <strong>
              {right
                ? t('答对了。', 'Correct.')
                : t(`答案是 ${letters}。`, `The answer is ${letters}.`)}
            </strong>{' '}
            {wrongPicks.map((j) => (
              <span key={j} className="oa-mcq-pick-why">
                {t(`你选的 ${LETTERS[j]}：`, `Your pick ${LETTERS[j]}: `)}
                {text.whys![j]}
              </span>
            ))}
            {text.explain}
          </p>
        )}
      </div>
      {children}
    </fieldset>
  );
}

const PALETTE_STATES = {
  answered: ['已答', 'answered'],
  unanswered: ['未答', 'unanswered'],
  flagged: ['待查', 'marked for review'],
} as const;
/**
 * An exam MCQ section's question palette: one cell per question, answered, unanswered or marked
 * for review (data-state, a shape and the cell's label, not colour alone). A click scrolls to that
 * question (`#mcq-q-<index>`) and focuses it.
 */
export function McqPalette({
  picks,
  flags = [],
  zh,
}: {
  picks: readonly (readonly number[])[];
  flags?: readonly number[];
  zh: boolean;
}) {
  const t = (a: string, b: string) => (zh ? a : b);
  const states = picks.map((p, i) => (flags.includes(i) ? 'flagged' : p.length ? 'answered' : 'unanswered'));
  const count = (state: keyof typeof PALETTE_STATES) => states.filter((s) => s === state).length;
  return (
    <nav className="oa-mcq-palette" aria-label={t('题号面板', 'Question palette')}>
      <ol>
        {states.map((state, i) => {
          const label = `Q${i + 1}, ${t(...PALETTE_STATES[state])}${state === 'flagged' && picks[i].length ? t('，已答', ', answered') : ''}`;
          return (
            <li key={i}>
              <button
                type="button"
                data-state={state}
                aria-label={label}
                title={label}
                onClick={() => {
                  const target = document.getElementById(`mcq-q-${i}`);
                  target?.scrollIntoView?.({ block: 'center' });
                  target?.focus({ preventScroll: true });
                }}
              >
                {i + 1}
              </button>
            </li>
          );
        })}
      </ol>
      <p className="oa-mcq-palette-key">
        {(Object.keys(PALETTE_STATES) as (keyof typeof PALETTE_STATES)[]).map((state) => (
          <span key={state} data-state={state}>
            <i aria-hidden="true" />
            {t(...PALETTE_STATES[state])} {count(state)}
          </span>
        ))}
      </p>
    </nav>
  );
}
