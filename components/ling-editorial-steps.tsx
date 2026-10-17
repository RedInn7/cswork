'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { StatementMarkdown } from './statement-markdown';
import { followUpRule } from '@/lib/code-analyzer';
import type { LingEditorial as Editorial, LingFollowUps } from '@/lib/oj-client';
import type { Language } from '@/lib/problems';
import { ROUTE_SLUGS, STOP_NAMES } from '@/lib/route-stops';

type Approach = Editorial['approaches'][number];
/** Distractors for "what is its time complexity?", slowest last. */
const COMMON = ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n^2)', 'O(n^3)', 'O(2^n)'];
// n² and n^2, m·n and mn are one answer.
const norm = (cost: string) => cost.replace(/²/g, '^2').replace(/³/g, '^3').replace(/[\s·*]/g, '');

/** Four distinct complexities: the first approach's, the other approaches', then common ones, in growth order. */
export function timeOptions(approaches: Approach[]) {
  const seen = new Map<string, string>();
  for (const cost of [...approaches.map((a) => a.time), ...COMMON])
    if (seen.size < 4 && !seen.has(norm(cost))) seen.set(norm(cost), cost);
  const rank = (cost: string) => {
    const i = COMMON.findIndex((c) => norm(c) === norm(cost));
    return i < 0 ? COMMON.length : i;
  };
  return [...seen.values()].sort((a, b) => rank(a) - rank(b));
}

/** The problem's stop and up to three neighbours on the line, in line order; [] off the line. */
export function stopOptions(stop: string | null | undefined) {
  const at = stop ? ROUTE_SLUGS.indexOf(stop) : -1;
  if (at < 0) return [];
  const near = [at - 1, at + 1, at - 2, at + 2, at - 3, at + 3].filter((i) => i >= 0 && i < ROUTE_SLUGS.length);
  return [at, ...near.slice(0, 3)].sort((a, b) => a - b).map((i) => ROUTE_SLUGS[i]);
}

function Checkpoint({
  question,
  options,
  answer,
  label,
  english,
}: {
  question: string;
  options: string[];
  answer: string;
  label: (option: string) => string;
  english: boolean;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <fieldset className="cs-ling-check">
      <legend>{question}</legend>
      <div>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={picked === option}
            data-right={picked !== null && option === answer ? '' : undefined}
            onClick={() => setPicked(option)}
          >
            {label(option)}
          </button>
        ))}
      </div>
      <p role="status">
        {picked === null
          ? ''
          : picked === answer
            ? english
              ? 'Right.'
              : '答对了。'
            : english
              ? `Not quite: it is ${label(answer)}.`
              : `不对，是 ${label(answer)}。`}
      </p>
    </fieldset>
  );
}

/**
 * The editorial step by step (two or more approaches only): ① the first approach and its time
 * (not asked when its idea already states it), ② the structure the problem builds on (its stop,
 * among its neighbours on the line), ③ the best approach's idea; then `onDone` shows every
 * approach with its code. Neutral wording: the first approach is not always a brute force nor
 * slower (2D DP, then a rolling array). Each step can be skipped; the checkpoints only tell right
 * from wrong, nothing is recorded.
 */
export function EditorialSteps({
  approaches,
  stop,
  english,
  onDone,
}: {
  approaches: Approach[];
  stop?: string | null;
  english: boolean;
  onDone: () => void;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const stops = stopOptions(stop);
  const steps = stops.length ? 3 : 2;
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (moved.current) heading.current?.focus();
  }, [step]);
  const first = approaches[0];
  const best = approaches.at(-1)!;
  const idea = english ? first.ideaEn : first.ideaZh;
  const kind = stops.length ? ['first', 'stop', 'best'][step] : ['first', 'best'][step];
  const next = () => {
    moved.current = true;
    if (step + 1 < steps) setStep(step + 1);
    else onDone();
  };
  const title =
    kind === 'first'
      ? t('先看第一种做法', 'Start with the first approach')
      : kind === 'stop'
        ? t('找结构', 'Name the structure')
        : t('最优解思路', 'The best approach');
  return (
    <div className="cs-ling-steps">
      <h3 ref={heading} tabIndex={-1}>
        <span className="cs-ling-step-count">{t(`第 ${step + 1} / ${steps + 1} 步`, `Step ${step + 1} of ${steps + 1}`)}</span>
        {title}
      </h3>
      {kind === 'first' && (
        <>
          <p className="cs-ling-step-name">{english ? first.nameEn : first.nameZh}</p>
          <StatementMarkdown body={idea} className="cs-statement-markdown cs-ling-idea" untrusted />
          {!norm(idea).includes(norm(first.time)) && (
            <Checkpoint
              key="time"
              question={t('它的时间复杂度是？', 'What is its time complexity?')}
              options={timeOptions(approaches)}
              answer={first.time}
              label={(option) => option}
              english={english}
            />
          )}
        </>
      )}
      {kind === 'stop' && (
        <Checkpoint
          key="stop"
          question={t('这道题用的是哪一站的结构？', 'Which stop on the line does this problem build on?')}
          options={stops}
          answer={stop!}
          label={(slug) => STOP_NAMES[slug]?.[english ? 1 : 0] ?? slug}
          english={english}
        />
      )}
      {kind === 'best' && (
        <>
          <p className="cs-ling-step-name">
            {english ? best.nameEn : best.nameZh} · {t('时间', 'Time')} {best.time} · {t('空间', 'Space')} {best.space}
          </p>
          <StatementMarkdown body={english ? best.ideaEn : best.ideaZh} className="cs-statement-markdown cs-ling-idea" untrusted />
        </>
      )}
      <button type="button" className="cs-ling-compare cs-ling-step-next" onClick={next}>
        {kind === 'best' ? t('看代码', 'Show the code') : t('下一步（可跳过）', 'Next (or skip)')}
        <ArrowRight size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * "What an interviewer may ask next": the problem's follow-up mode first (lib/content/follow-up-rules.json;
 * `followUpOn` is the workspace's switch and `onFollowUp` sets it, absent in ACM mode), then the
 * written follow-ups, answers folded, each optionally linking a problem to practise, and the takeaway.
 */
export function EditorialFollowUps({
  problemId,
  extras,
  language,
  english,
  followUpOn = false,
  onFollowUp,
}: {
  problemId: string;
  extras: Partial<LingFollowUps>;
  language: Language;
  english: boolean;
  followUpOn?: boolean;
  onFollowUp?: (on: boolean) => void;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const rule = followUpRule(problemId, language);
  const items = extras.followUps ?? [];
  if (!rule && !items.length && !extras.takeawayZh) return null;
  return (
    <section className="cs-ling-followups" aria-labelledby="ling-followups-title">
      <h3 id="ling-followups-title">{t('面试官可能追问', 'What the interviewer may ask next')}</h3>
      <ul>
        {rule && (
          <li>
            <p className="cs-ling-followup-q">{english ? `Now: ${rule.en}.` : `再加个限制：${rule.zh}。`}</p>
            <p>
              {t(
                '本题有追问模式：开启后，提交前会先检查代码是否用了题目不允许的写法。',
                'This problem has a follow-up mode: when on, your code is checked for the disallowed constructs before it is submitted.',
              )}
            </p>
            {onFollowUp ? (
              <label>
                <input type="checkbox" checked={followUpOn} onChange={(event) => onFollowUp(event.target.checked)} />{' '}
                {t('追问模式', 'Follow-up mode')}
              </label>
            ) : (
              <p>{t('切到 LeetCode 模式后可以开启。', 'Switch to LeetCode mode to turn it on.')}</p>
            )}
          </li>
        )}
        {items.map((item, i) => {
          const number = item.problem && /^lc-(\d+)$/.exec(item.problem)?.[1];
          return (
            <li key={i}>
              <details>
                <summary className="cs-ling-followup-q">{english ? item.qEn : item.qZh}</summary>
                <StatementMarkdown body={english ? item.aEn : item.aZh} className="cs-statement-markdown cs-ling-idea" untrusted />
                {item.problem && (
                  <a href={`/?view=problem&problem=${encodeURIComponent(item.problem)}`}>
                    {t(`去做这道：第 ${number} 题`, `Practise it: problem ${number}`)}
                  </a>
                )}
              </details>
            </li>
          );
        })}
      </ul>
      {extras.takeawayZh && (
        <p className="cs-ling-takeaway">
          <strong>{t('要点', 'Takeaway')}</strong>
          {english ? extras.takeawayEn : extras.takeawayZh}
        </p>
      )}
    </section>
  );
}
