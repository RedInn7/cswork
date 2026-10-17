'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, Gauge, LoaderCircle, Plus, Shuffle } from 'lucide-react';
import safe from '@/lib/content/stress-safe.json';
import { useT } from '@/lib/i18n';
import { activeStatuses, ojRequest, verdict, type OJCase, type OJProblem, type OJSubmission } from '@/lib/oj-client';
import { complexitySizes, firstMismatch, fitComplexity, STRESS_CASES, type ComplexityFit, type StressRule } from '@/lib/stress-gen';
import { diffLines } from '@/lib/testcase-fields';
import { CopyBlock, Verdict } from './oj-results';
import '@/app/stress-steps.css';

/** A whitelisted Line 500 problem (lib/content/stress-safe.json); the server checks it again. */
export const stressReady = (id: string) => Object.hasOwn(safe, id);

type Outcome =
  | { state: 'running' }
  | { state: 'error'; message: string }
  | { state: 'agree' }
  | { state: 'differ'; index: number; mine?: OJCase; reference: OJCase };

/**
 * "Stress test" under the LeetCode-mode custom cases: the learner's code and the editorial's
 * reference run on 30 small random cases the server draws (POST problems/:id/stress), and the
 * first one where they disagree (the smallest, cases run smallest first) shows with both
 * outputs, one click from becoming a custom case. Styled like the AI edge-case box above it.
 */
export function StressTest({
  problemId,
  code,
  language,
  checker,
  onAdd,
  solved = false,
}: {
  problemId: string;
  code: string;
  language: string;
  /** The problem's checker: exact or tokens on every whitelisted problem. */
  checker?: string;
  /** Adds the input as a custom case; false when there is no room. */
  onAdd: (input: string) => boolean;
  /** Accepted already: step 2 of the steps above is done. */
  solved?: boolean;
}) {
  const t = useT();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // Step 1 stays done once a batch agreed, whatever later batches say.
  const [agreed, setAgreed] = useState(false);
  const [added, setAdded] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function run() {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setOutcome({ state: 'running' });
    setAdded(false);
    const get = (id: string) => ojRequest<OJSubmission>(`submissions/${id}`, undefined, current.signal);
    try {
      const pair = await ojRequest<{ id: string; referenceId: string }>(
        `problems/${encodeURIComponent(problemId)}/stress`,
        { seed: Math.floor(Math.random() * 2 ** 31), language, code },
        current.signal,
      );
      // Plain polls, like the custom case's reference output: the run's own watch may hold a long poll.
      let mine: OJSubmission, reference: OJSubmission;
      do {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        [mine, reference] = await Promise.all([get(pair.id), get(pair.referenceId)]);
      } while (activeStatuses.has(mine.status) || activeStatuses.has(reference.status));
      if (current.signal.aborted) return;
      if (mine.status === 'compile_error')
        return setOutcome({
          state: 'error',
          message: t('你的代码没有通过编译，先点“运行”看看报错。', "Your code didn't compile. Run it first to see the error."),
        });
      if (reference.status !== 'finished' || ['cancelled', 'system_error'].includes(mine.status))
        return setOutcome({
          state: 'error',
          message: t('这批用例没有跑完，请再拍一次。', "This batch didn't finish. Please try again."),
        });
      const references = reference.cases ?? [];
      const index = firstMismatch(mine.cases ?? [], references, checker ?? 'exact');
      if (index < 0) {
        setAgreed(true);
        // The progress page counts problems stress-checked before their first AC; the server compares the runs again.
        if (!solved)
          void ojRequest(`problems/${encodeURIComponent(problemId)}/aids`, {
            kind: 'brute',
            submissionId: pair.id,
            referenceId: pair.referenceId,
          }).catch(() => {});
      }
      setOutcome(
        index < 0 ? { state: 'agree' } : { state: 'differ', index, mine: mine.cases?.[index], reference: references[index] },
      );
    } catch (e) {
      if (!current.signal.aborted) setOutcome({ state: 'error', message: (e as Error).message });
    }
  }
  const differ = outcome?.state === 'differ' ? outcome : null;
  const input = differ?.reference.stdin;
  const diff =
    differ?.mine?.status === 'finished' && differ.mine.stdout !== undefined
      ? diffLines(differ.mine.stdout, differ.reference.stdout ?? '')
      : undefined;
  return (
    <section className="cs-ai-cases" aria-label={t('对拍', 'Stress test')}>
      <ol className="cs-stress-steps">
        {(
          [
            [agreed, t('第 1 步：小数据上和参考解一致', 'Step 1: match the reference on small cases')],
            [solved, t('第 2 步：通过全部测试', 'Step 2: pass every test')],
          ] as const
        ).map(([done, label], i) => (
          <li key={i} data-done={done || undefined}>
            <i aria-hidden="true">{done ? <Check size={12} /> : i + 1}</i>
            {label}
            {done && <span className="sr-only">{t('（已完成）', ' (done)')}</span>}
          </li>
        ))}
      </ol>
      <button type="button" className="cs-ai-cases-ask" disabled={outcome?.state === 'running' || !code.trim()} onClick={() => void run()}>
        {outcome?.state === 'running' ? (
          <LoaderCircle size={14} className="cs-spin" aria-hidden="true" />
        ) : (
          <Shuffle size={14} aria-hidden="true" />
        )}
        {outcome?.state === 'running' ? t('正在对拍…', 'Stress testing…') : t('对拍', 'Stress test')}
      </button>
      <p className="cs-console-note">
        {t(
          `用 ${STRESS_CASES} 组随机小数据同时运行你的代码和参考解，找出第一组输出不一致的用例。`,
          `Runs your code and the reference solution on ${STRESS_CASES} small random cases and shows the first one where the outputs differ.`,
        )}
      </p>
      <div aria-live="polite">
        {outcome?.state === 'error' && (
          <p className="cs-console-note" role="alert">
            {outcome.message}
          </p>
        )}
        {outcome?.state === 'agree' && (
          <p className="cs-console-note">
            {t(
              `${STRESS_CASES} 组全部和参考解一致。没找到反例不代表一定正确，可以再拍一批。`,
              `All ${STRESS_CASES} cases match the reference. No counterexample isn't proof; try another batch.`,
            )}
          </p>
        )}
        {differ && input !== undefined && (
          <>
            <p className="cs-console-note">
              {t(
                `第 ${differ.index + 1} 组（共 ${STRESS_CASES} 组，从小到大）和参考解不一致：`,
                `Case ${differ.index + 1} of ${STRESS_CASES} (smallest first) disagrees with the reference:`,
              )}
            </p>
            <CopyBlock label={t('输入', 'Input')} value={input} />
            <CopyBlock label={t('参考输出', 'Reference output')} value={differ.reference.stdout ?? ''} diff={diff} />
            {diff ? (
              <CopyBlock label={t('你的输出', 'Your output')} value={differ.mine!.stdout!} diff={diff} />
            ) : (
              <>
                <Verdict submission={{ status: differ.mine?.status ?? 'skipped', mode: 'run' }} />
                {differ.mine?.stderr && <CopyBlock label={t('错误输出', 'Stderr')} value={differ.mine.stderr} />}
              </>
            )}
            <button
              type="button"
              className="cs-ai-cases-ask"
              disabled={added}
              onClick={() => onAdd(input) && setAdded(true)}
            >
              {added ? <Check size={13} aria-hidden="true" /> : <Plus size={13} aria-hidden="true" />}
              {added ? t('已加入', 'Added') : t('加入自定义用例', 'Add to my cases')}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

type Probe = {
  running: boolean;
  /** One row a size: the faster run's CPU time, and how that size went. */
  rows: { n: number; ms?: number; status: string }[];
  fit?: ComplexityFit;
  error?: string;
  /** The failing size's stderr, for a runtime error. */
  stderr?: string;
};
const GRADES: [string, string][] = [
  ['约 O(n) 或 O(n log n)', 'about O(n) or O(n log n)'],
  ['介于 O(n log n) 和 O(n²) 之间', 'between O(n log n) and O(n²)'],
  ['约 O(n²)', 'about O(n²)'],
  ['达 O(n³) 或更高', 'like O(n³) or worse'],
];

/**
 * "Probe complexity" under the stress test: the learner's code on growing random inputs
 * (POST problems/:id/complexity; the server draws them, lib/stress-gen.ts complexityCases), a
 * small table of CPU time by size, and the growth fitComplexity reads off it, beside the
 * editorial's target. Only where the server would accept it: a whitelisted problem with a length to scale.
 */
export function ComplexityProbe({
  problem,
  code,
  language,
}: {
  problem: Pick<OJProblem, 'id' | 'leetcodeParams' | 'leetcodeConstraints' | 'targetComplexity'>;
  code: string;
  language: string;
}) {
  const t = useT();
  const [probe, setProbe] = useState<Probe | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const rules = (safe as Record<string, Record<string, StressRule>>)[problem.id];
  if (!rules || !problem.leetcodeParams || !complexitySizes(problem.leetcodeParams, problem.leetcodeConstraints ?? null, rules))
    return null;
  async function run() {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setProbe({ running: true, rows: [] });
    try {
      const { id, sizes } = await ojRequest<{ id: string; sizes: number[] }>(
        `problems/${encodeURIComponent(problem.id)}/complexity`,
        { language, code },
        current.signal,
      );
      let latest: OJSubmission;
      do {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        latest = await ojRequest<OJSubmission>(`submissions/${id}`, undefined, current.signal);
        if (current.signal.aborted) return;
        const points = sizes.map((n, i) => ({ n, ms: latest.cases?.[i]?.runtimeMs ?? 0, status: latest.cases?.[i]?.status ?? 'pending' }));
        const rows = [...new Set(sizes)].map((n) => {
          const runs = points.filter((p) => p.n === n);
          const done = runs.filter((p) => p.status === 'finished');
          return done.length
            ? { n, ms: Math.min(...done.map((p) => p.ms)), status: 'finished' }
            : { n, status: (runs.find((p) => p.status !== 'skipped') ?? runs[0]).status };
        });
        const running = activeStatuses.has(latest.status);
        const error =
          latest.status === 'compile_error'
            ? t('你的代码没有通过编译，先点“运行”看看报错。', "Your code didn't compile. Run it first to see the error.")
            : ['cancelled', 'system_error'].includes(latest.status)
              ? t('这次测量没有跑完，请再测一次。', "This probe didn't finish. Please try again.")
              : undefined;
        setProbe({
          running,
          rows: error ? [] : rows,
          error,
          fit: running || error ? undefined : fitComplexity(points),
          stderr: latest.cases?.find((c) => c.status === 'runtime_error')?.stderr,
        });
      } while (activeStatuses.has(latest.status));
    } catch (e) {
      if (!current.signal.aborted) setProbe({ running: false, rows: [], error: (e as Error).message });
    }
  }
  const fit = probe?.fit;
  const slope = (b?: number) => (b === undefined ? '' : t(`（斜率 ${b.toFixed(2)}）`, ` (slope ${b.toFixed(2)})`));
  const top = Math.max(1, ...(probe?.rows.map((r) => r.ms ?? 0) ?? []));
  return (
    <section className="cs-ai-cases" aria-label={t('测复杂度', 'Probe complexity')}>
      <button type="button" className="cs-ai-cases-ask" disabled={probe?.running || !code.trim()} onClick={() => void run()}>
        {probe?.running ? <LoaderCircle size={14} className="cs-spin" aria-hidden="true" /> : <Gauge size={14} aria-hidden="true" />}
        {probe?.running ? t('正在测量…', 'Probing…') : t('测复杂度', 'Probe complexity')}
      </button>
      <p className="cs-console-note">
        {t(
          '在越来越大的随机输入上计时（n 是数组或字符串长度，网格按格子数），拟合用时的增长。测的是 CPU 时间，包含解释器启动；大输入随机生成，没有逐题核对题目的隐含条件，也不检查答案对错，建议先通过再测。主要用来揪出 O(n²)。',
          'Times your code on growing random inputs (n is the array or string length; a grid counts cells) and fits how the time grows. It measures CPU time, interpreter start-up included. The large inputs are random, not checked against each problem’s implicit conditions, and answers aren’t checked, so get Accepted first. Best at catching an O(n²).',
        )}
      </p>
      {!!probe?.rows.length && (
        <table className="cs-probe-table">
          <caption className="sr-only">{t('各规模的 CPU 用时', 'CPU time by input size')}</caption>
          <thead>
            <tr>
              <th scope="col">n</th>
              <th scope="col">{t('用时', 'Time')}</th>
              <th scope="col">{t('状态', 'Status')}</th>
            </tr>
          </thead>
          <tbody>
            {probe.rows.map((r) => (
              <tr key={r.n}>
                <td>{r.n.toLocaleString()}</td>
                <td>
                  {r.ms === undefined ? '—' : `${Math.round(r.ms)} ms`}
                  {r.ms !== undefined && <i aria-hidden="true" style={{ width: `${(r.ms / top) * 100}%` }} />}
                </td>
                <td>{t(...verdict(r.status))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div aria-live="polite">
        {probe?.error && (
          <p className="cs-console-note" role="alert">
            {probe.error}
          </p>
        )}
        {fit && (
          <p className="cs-console-note">
            <strong>
              {fit.kind === 'fit'
                ? t(`增长${GRADES[fit.grade][0]}`, `Grows ${GRADES[fit.grade][1]}`) + slope(fit.slope)
                : fit.kind === 'fast'
                  ? t('太快，测不出增长', 'Too fast to tell')
                  : fit.kind === 'timeout'
                    ? t(`在 n=${fit.n} 超时`, `Timed out at n=${fit.n}`) + slope(fit.slope)
                    : t(`这组大输入让程序出错（n=${fit.n}，${verdict(fit.status)[0]}）`, `These large inputs made it fail (n=${fit.n}, ${verdict(fit.status)[1]})`)}
              {t('。', '.')}
            </strong>
            {fit.kind === 'fit' && fit.few && t('只有两个点，仅供参考。', ' Two points only: a rough read.')}
            {fit.kind === 'fast' && fit.large && t('到 n ≥ 4096 仍很快，至多约 O(n log n)。', ' Still quick at n ≥ 4096, so at most about O(n log n).')}
            {problem.targetComplexity && t(`题解目标：${problem.targetComplexity.time}。`, ` Editorial target: ${problem.targetComplexity.time}.`)}
          </p>
        )}
        {fit?.kind === 'error' && probe?.stderr && <CopyBlock label={t('错误输出', 'Stderr')} value={probe.stderr} />}
      </div>
    </section>
  );
}
