'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, LoaderCircle, Plus, Shuffle } from 'lucide-react';
import safe from '@/lib/content/stress-safe.json';
import { useT } from '@/lib/i18n';
import { activeStatuses, ojRequest, type OJCase, type OJSubmission } from '@/lib/oj-client';
import { firstMismatch, STRESS_CASES } from '@/lib/stress-gen';
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
