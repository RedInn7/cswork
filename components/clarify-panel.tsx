'use client';
import { useMemo, useState } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import safe from '@/lib/content/stress-safe.json';
import { clarifyItems } from '@/lib/clarify';
import type { LingEdge } from '@/lib/oj-client';
import type { StressRule } from '@/lib/stress-gen';
import type { Constraint } from '@/lib/testcase-fields';
import '@/app/clarify-panel.css';

const rules = safe as Record<string, Record<string, StressRule>>;
/** One JSON value per line, shown on one line. */
const preview = (input: string) => input.split('\n').join('  ·  ');

/**
 * "Before you code: clarify and edge cases", folded under the statement. The learner ticks the
 * questions they would ask and notes their own edge cases (this page only), then opens the
 * reference: what the bounds answer (lib/clarify.ts) and the problem's checked edge cases
 * (lib/content/ling-edges.json). `onAdd` adds custom cases and returns how many didn't fit;
 * without it (ACM mode) the cases are text only.
 */
export function ClarifyPanel({
  problemId,
  params,
  constraints,
  edges,
  english,
  onAdd,
}: {
  problemId: string;
  params: { name: string; type: string }[];
  constraints: Record<string, Constraint> | null;
  edges: LingEdge[] | null;
  english: boolean;
  onAdd?: (inputs: string[]) => number;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const items = useMemo(
    () => clarifyItems(params, constraints, Object.hasOwn(rules, problemId) ? rules[problemId] : null),
    [params, constraints, problemId],
  );
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState<string[]>([]);
  const [mine, setMine] = useState('');
  const [shown, setShown] = useState(false);
  const [note, setNote] = useState('');
  const all = [...new Set([...items.flatMap((item) => item.cases), ...(edges ?? []).map((edge) => edge.input)])];
  const add = (inputs: string[]) => {
    if (!onAdd) return;
    const left = onAdd(inputs);
    setNote(
      left
        ? t(
            `自定义用例已满，有 ${left} 个没放下：先删掉几个再加。`,
            `Your custom cases are full; ${left} didn't fit. Delete some, then add again.`,
          )
        : t('已加入自定义用例，运行即可对照。', 'Added to your custom cases; run them to compare.'),
    );
  };
  const addButton = (input: string, what: string) =>
    onAdd && (
      <button type="button" className="cs-clarify-add" onClick={() => add([input])} aria-label={t(`加为用例：${what}`, `Add case: ${what}`)}>
        <Plus size={13} aria-hidden="true" />
        {t('加为用例', 'Add case')}
      </button>
    );
  const answered = items.filter((item) => item.answer);
  const unanswered = items.filter((item) => !item.answer);
  const mark = (
    <span className="cs-clarify-asked">
      <Check size={13} aria-hidden="true" />
      <span className="sr-only">{t('你问到了：', 'You asked: ')}</span>
    </span>
  );
  return (
    <section className="cs-clarify" aria-labelledby="clarify-title">
      <h3 id="clarify-title">
        <button type="button" aria-expanded={open} aria-controls="clarify-body" onClick={() => setOpen((value) => !value)}>
          {t('开写前：澄清和边界', 'Before you code: clarify and edge cases')}
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </h3>
      <div id="clarify-body" hidden={!open}>
        <fieldset className="cs-clarify-ask">
          <legend>{t('面试时你会先问哪些？勾上再对照。', 'Which would you ask the interviewer? Tick them, then compare.')}</legend>
          {items.map((item) => (
            <label key={item.key}>
              <input
                type="checkbox"
                checked={asked.includes(item.key)}
                onChange={(event) =>
                  setAsked((keys) => (event.target.checked ? [...keys, item.key] : keys.filter((key) => key !== item.key)))
                }
              />
              {english ? item.question[1] : item.question[0]}
            </label>
          ))}
        </fieldset>
        <label className="cs-clarify-mine">
          {t('我想到的边界（只在本页有效，不保存）', 'Edge cases I can think of (this page only, not saved)')}
          <textarea value={mine} onChange={(event) => setMine(event.target.value)} rows={3} />
        </label>
        {!shown ? (
          <button type="button" className="cs-clarify-reveal" onClick={() => setShown(true)}>
            {t('对照参考清单', 'Compare with the checklist')}
          </button>
        ) : (
          <div className="cs-clarify-reference">
            {answered.length > 0 && (
              <>
                <h4>{t('题目约束已经回答的', 'What the constraints already answer')}</h4>
                <ul>
                  {answered.map((item) => (
                    <li key={item.key}>
                      <p>
                        {asked.includes(item.key) && mark}
                        <strong>{english ? item.question[1] : item.question[0]}</strong>{' '}
                        {english ? item.answer![1] : item.answer![0]}
                      </p>
                      {item.cases.map((input) => (
                        <div key={input} className="cs-clarify-case">
                          <code>{preview(input)}</code>
                          {addButton(input, english ? item.question[1] : item.question[0])}
                        </div>
                      ))}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <h4>{t('题面没写明的，开口问', "Not in the statement: ask")}</h4>
            <ul>
              {unanswered.map((item) => (
                <li key={item.key}>
                  <p>
                    {asked.includes(item.key) && mark}
                    {english ? item.question[1] : item.question[0]}
                  </p>
                </li>
              ))}
            </ul>
            {!!edges?.length && (
              <>
                <h4>{t('这道题值得测的边界', 'Edge cases worth testing here')}</h4>
                <ul>
                  {edges.map((edge) => (
                    <li key={edge.input}>
                      <p>{english ? edge.en : edge.zh}</p>
                      <div className="cs-clarify-case">
                        <code>{preview(edge.input)}</code>
                        {addButton(edge.input, english ? edge.en : edge.zh)}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {onAdd
              ? all.length > 1 && (
                  <button type="button" className="cs-clarify-all" onClick={() => add(all)}>
                    <Plus size={14} aria-hidden="true" />
                    {t(`全部加为自定义用例（${all.length} 个）`, `Add all as custom cases (${all.length})`)}
                  </button>
                )
              : all.length > 0 && (
                  <p className="cs-clarify-hint">
                    {t('切到 LeetCode 模式后，可以一键加为自定义用例。', 'Switch to LeetCode mode to add these as custom cases.')}
                  </p>
                )}
            <p role="status" className="cs-clarify-hint">
              {note}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
