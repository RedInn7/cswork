'use client';

import { useEffect, useState } from 'react';
import { MCQ_TOPIC_NAMES } from '@/components/oa-mcq';
import { STEP_DONE, stepTitle, type ResolvedStep, type RoleKey } from '@/lib/content/role-paths';
import { parseMcqReview } from '@/lib/mock-oa';
import { ojRequest } from '@/lib/oj-client';
import '@/app/role-path.css';

type Role = { key: RoleKey; name: string; blurb: string };
type Count = { done: number; total: number };

/** What the learner has done, as the step keys name it (lib/content/role-paths.ts ResolvedStep). */
async function achievedKeys(steps: ResolvedStep[], signal: AbortSignal) {
  const keys = steps.flatMap((s) => s.keys);
  const need = (prefix: string) => keys.some((k) => k.startsWith(prefix));
  const done = new Set<string>();
  // Signed out this answers 401 and the path stays a guest's.
  const marks = await ojRequest<{ items: { target: string; mark: string }[] }>('marks', undefined, signal);
  for (const { target, mark } of marks.items) if (mark === 'read' || mark === 'done') done.add(target);
  const [history, note] = await Promise.all([
    need('problem:')
      ? ojRequest<{ items: { problemId: string; firstAcAt: number | null }[] }>('history', undefined, signal)
      : null,
    need('mcq:') ? ojRequest<{ body: string }>(`notes?target=${encodeURIComponent('mcq:answers')}`, undefined, signal) : null,
  ]);
  for (const item of history?.items ?? []) if (item.firstAcAt) done.add(`problem:${item.problemId}`);
  for (const id of Object.keys(parseMcqReview(note?.body))) done.add(`mcq:${id}`);
  return done;
}

const counted = (step: ResolvedStep) => step.keys.length > 0 && !step.unavailable;
const stateOf = ({ done, total }: Count) => (done >= total * STEP_DONE ? 'done' : done > 0 ? 'active' : 'todo');

/**
 * /roadmap's role picker (?role=) and the chosen role's steps as stations on one line. Signed in,
 * each counted step shows how much of it is done from the APIs the site already has: read marks
 * (system design and course chapters), the practice history (problems), done marks (projects and
 * frontend JS problems) and the MCQ review note. Mock interviews never count; an AI-only one reads unavailable while AI is off.
 */
export function RolePath({
  english,
  role,
  roles,
  steps,
}: {
  english: boolean;
  role: RoleKey | null;
  roles: Role[];
  steps: ResolvedStep[];
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [done, setDone] = useState<ReadonlySet<string> | null>(null);
  useEffect(() => {
    if (!role) return;
    const controller = new AbortController();
    achievedKeys(steps, controller.signal).then(setDone, () => setDone(null));
    return () => controller.abort();
  }, [role, steps]);
  const current = roles.find((r) => r.key === role);
  const counts = steps.map((s): Count => ({ done: done ? s.keys.filter((k) => done.has(k)).length : 0, total: s.keys.length }));
  const required = steps.map((s, i) => [s, counts[i]] as const).filter(([s]) => !s.optional && counted(s));
  const finished = required.filter(([, c]) => stateOf(c) === 'done').length;
  const title = (s: ResolvedStep) =>
    s.kind === 'mcq-topic'
      ? stepTitle(s.kind, MCQ_TOPIC_NAMES[s.ref] ? t(...MCQ_TOPIC_NAMES[s.ref]) : s.ref, !english)
      : s.title;
  return (
    <section className="roadmap-track role-path" id="role-path" aria-labelledby="role-path-title">
      <h2 id="role-path-title">{t('按岗位的路线', 'Paths by role')}</h2>
      <p className="roadmap-lead">
        {t(
          '选一个目标岗位，按顺序走完一条线：算法站点、系统设计、SQL、选择题和一个简历项目，都指向站内已有的内容。',
          'Pick the role you are aiming for and follow one line in order: algorithm stops, system design, SQL, multiple choice and a resume project, all pointing at what the site already has.',
        )}
      </p>
      <nav aria-label={t('选择岗位', 'Choose a role')}>
        <ul className="role-path-roles">
          {roles.map((r) => (
            <li key={r.key}>
              <a href={`/roadmap?role=${r.key}#role-path`} aria-current={r.key === role ? 'page' : undefined}>
                {r.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {current && (
        <>
          <p className="role-path-blurb">{current.blurb}</p>
          <p className="role-path-progress" role="status">
            {done
              ? t(`必做 ${required.length} 步，已完成 ${finished} 步。`, `${finished} of ${required.length} required steps done.`)
              : t('登录后，每一步会显示你的完成度。', 'Sign in to see how far you are on each step.')}
          </p>
          <ol className="role-path-steps">
            {steps.map((s, i) => {
              const count = counts[i];
              const state = done && counted(s) ? stateOf(count) : undefined;
              return (
                <li key={`${s.kind}:${s.ref}`} data-state={state} data-optional={s.optional || undefined} data-off={s.unavailable || undefined}>
                  <div className="role-path-head">
                    <a href={s.href}>{title(s)}</a>
                    {s.optional && <span className="role-path-tag">{t('选做', 'Optional')}</span>}
                    {s.unavailable && <span className="role-path-tag" data-off>{t('暂不可用', 'Unavailable')}</span>}
                    {state && (
                      <span className="role-path-count">
                        {state === 'done' && <span className="sr-only">{t('已完成，', 'Done, ')}</span>}
                        {count.done}/{count.total}
                      </span>
                    )}
                  </div>
                  {s.unavailable && (
                    <p className="role-path-note">
                      {t(
                        'AI 面试官目前没有开放，这一步不计入进度。可以先用其他模拟面，或找同伴互相面试。',
                        'The AI interviewer is not available right now, so this step does not count. Try another mock interview, or practise with a peer.',
                      )}
                    </p>
                  )}
                  {s.stops && (
                    <ul className="role-path-stops" aria-label={t('站点', 'Stops')}>
                      {s.stops.map((stop) => (
                        <li key={stop.slug}>
                          <a href={stop.href}>{stop.name}</a>
                        </li>
                      ))}
                    </ul>
                  )}
                  {s.plan && (
                    <a className="role-path-plan" href={s.plan}>
                      {t('用这几站生成学习计划', 'Make a study plan from these stops')}
                    </a>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="roadmap-note">
            {t(
              `完成一步的标准：读完、做对或答过其中 ${STEP_DONE * 100}% 的内容；项目以标记「完成」为准。选做和模拟面不计入进度。`,
              `A step is done at ${STEP_DONE * 100}% of it read, solved or answered; a project when you mark it done. Optional steps and mock interviews do not count.`,
            )}
          </p>
        </>
      )}
    </section>
  );
}
