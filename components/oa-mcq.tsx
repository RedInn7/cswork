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
 * and marks the answer with its explanation; `children` go under it (a submit button, say).
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
  return (
    <fieldset className="oa-mcq-item">
      <legend>
        <span className="oa-mcq-qno" aria-hidden="true">
          Q{n}
        </span>
        {text.q}
      </legend>
      {q.code && (
        <pre className="oa-mcq-code">
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
            {text.explain}
          </p>
        )}
      </div>
      {children}
    </fieldset>
  );
}
