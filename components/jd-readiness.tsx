'use client';
import { useEffect, useRef, useState } from 'react';
import { ojRequest } from '@/lib/oj-client';
import {
  JD_CHARS,
  JD_HANDOFF_KEY,
  JD_MIN,
  JD_ROUND_INFO,
  JD_SKILL_INFO,
  PLAN_TOPICS_PARAM,
  type JdItem,
  type JdReport,
  type Readiness,
} from '@/lib/jd-skills';

type Reply = JdReport & { remaining: number; limit: number; bonus: number };

/** The study plan with these Line 500 stops preselected as its topics (components/study-plan.tsx). */
export const planHref = (stops: string[]) =>
  `/?${new URLSearchParams({ view: 'problems', [PLAN_TOPICS_PARAM]: stops.join(',') })}`;

/**
 * /career/jd: paste a job description, get a readiness checklist (lib/server/ai-jd.ts): each skill
 * it asks for with the learner's progress and a practice link, the likely rounds, and the gaps
 * handed to the Line 500 sprint plan. The posting lives only in this page's state.
 */
export function JdReadiness({ zh }: { zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [job, setJob] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [signedOut, setSignedOut] = useState(false),
    [left, setLeft] = useState<number | null>(null),
    [report, setReport] = useState<JdReport | null>(null);
  const result = useRef<HTMLElement>(null);
  useEffect(() => {
    // Sent over once from the resume review (components/resume-review.tsx); not kept.
    try {
      const sent = sessionStorage.getItem(JD_HANDOFF_KEY);
      sessionStorage.removeItem(JD_HANDOFF_KEY);
      // oxlint-disable-next-line react/react-compiler -- Hydrate from browser storage after SSR.
      if (sent) setJob(sent.slice(0, JD_CHARS));
    } catch {
      // Blocked storage: the form starts empty.
    }
    let live = true;
    ojRequest<Record<string, number>>('ai/usage')
      .then((usage) => live && setLeft((usage.jd ?? 0) + (usage.bonus ?? 0)))
      .catch((e: Error & { status?: number | string }) => {
        if (live && e.status === 401) setSignedOut(true);
      });
    return () => {
      live = false;
    };
  }, []);
  // A new checklist takes focus, so a screen reader starts reading it.
  useEffect(() => {
    if (report) result.current?.focus();
  }, [report]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const reply = await ojRequest<Reply>('ai/jd', { job });
      setReport({ skills: reply.skills, likelyRounds: reply.likelyRounds, planStops: reply.planStops });
      setLeft(reply.remaining + (reply.bonus ?? 0));
    } catch (e) {
      const failure = e as Error & { status?: number | string };
      if (failure.status === 401) setSignedOut(true);
      else setError(failure.message);
      if (failure.status === 429) setLeft(0);
    } finally {
      setBusy(false);
    }
  }
  if (signedOut)
    return (
      <div className="resume-off">
        <p>{t('登录后才能使用 JD 准备度检查。', 'Sign in to check a job description.')}</p>
        <a href="/?view=account">{t('登录 / 注册', 'Sign in / sign up')} →</a>
      </div>
    );
  const statusName: Record<Readiness, string> = {
    ready: t('已就绪', 'Ready'),
    partial: t('部分掌握', 'In progress'),
    gap: t('缺口', 'Gap'),
    unmeasured: t('未度量', 'Not measured'),
  };
  const count = (status: Readiness) => report?.skills.filter((s) => s.status === status).length ?? 0;
  // Unmeasured skills are no verdict: neither a gap to close here nor a reason to say all is ready.
  const gaps = count('partial') + count('gap');
  const unmeasured = count('unmeasured');
  return (
    <div className="resume-review">
      <form className="resume-form" onSubmit={submit} aria-describedby="resume-privacy">
        <label htmlFor="jd-text">
          {t('职位描述', 'Job description')}
          <small id="jd-text-hint">
            {t(
              `把职位描述全文粘贴进来，至少 ${JD_MIN} 个字符；超过 ${JD_CHARS.toLocaleString('en-US')} 个字符的部分不会读取。`,
              `Paste the whole posting: at least ${JD_MIN} characters. Anything past ${JD_CHARS.toLocaleString('en-US')} characters is not read.`,
            )}
          </small>
          <textarea
            id="jd-text"
            value={job}
            onChange={(e) => setJob(e.target.value)}
            maxLength={JD_CHARS}
            required
            aria-describedby="jd-text-hint"
          />
        </label>
        <div className="resume-actions">
          <button type="submit" disabled={busy || job.trim().length < JD_MIN || left === 0}>
            {busy ? t('正在分析…（约 15 秒）', 'Checking… (about 15 seconds)') : t('检查准备度', 'Check my readiness')}
          </button>
          <small aria-live="polite">
            {left === null
              ? ''
              : left > 0
                ? t(`今天还可以分析 ${left} 次`, `${left} ${left === 1 ? 'check' : 'checks'} left today`)
                : t('今天的次数已用完，明天再来', "You've used today's checks. Come back tomorrow")}
          </small>
        </div>
        {error && (
          <p className="resume-error" role="alert">
            {error}
          </p>
        )}
      </form>
      {report && (
        <section className="resume-result" ref={result} tabIndex={-1} aria-labelledby="jd-result-title">
          <h2 id="jd-result-title">{t('准备度清单', 'Your readiness checklist')}</h2>
          {report.skills.length ? (
            <p className="resume-summary">
              {t(
                `职位要求的 ${report.skills.length} 项里：${count('ready')} 项已就绪，${count('partial')} 项部分掌握，${count('gap')} 项还是缺口${unmeasured ? `，${unmeasured} 项本站无法度量` : ''}。`,
                `This posting asks for ${report.skills.length} ${report.skills.length === 1 ? 'skill' : 'skills'}: ${count('ready')} ready, ${count('partial')} in progress, ${count('gap')} ${count('gap') === 1 ? 'gap' : 'gaps'}${unmeasured ? `, ${unmeasured} not measured here` : ''}.`,
              )}
            </p>
          ) : (
            <p className="resume-summary">
              {t(
                '没有从这段文字里读到技能要求。确认粘贴的是完整的职位描述。',
                'No skill requirements found in this text. Check that you pasted the whole job description.',
              )}
            </p>
          )}
          {report.likelyRounds.length > 0 && (
            <div>
              <h3>{t('可能的面试环节', 'Likely rounds')}</h3>
              <ol className="jd-rounds">
                {report.likelyRounds.map((round) => (
                  <li key={round}>
                    <a href={JD_ROUND_INFO[round].href}>{zh ? JD_ROUND_INFO[round].zh : JD_ROUND_INFO[round].en}</a>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {(['must', 'nice'] as const).map((importance) => {
            const items = report.skills.filter((s) => s.importance === importance);
            return (
              items.length > 0 && (
                <div key={importance}>
                  <h3>{importance === 'must' ? t('必须', 'Required') : t('加分项', 'Nice to have')}</h3>
                  <ul className="jd-skills">
                    {items.map((item) => (
                      <SkillRow key={item.skill} item={item} status={statusName[item.status]} zh={zh} />
                    ))}
                  </ul>
                </div>
              )
            );
          })}
          {report.skills.length > 0 && (
            <div className="jd-plan">
              <h3>{t('学习计划', 'Study plan')}</h3>
              {report.planStops.length > 0 ? (
                <>
                  <p>
                    {t(
                      `打开 500 路冲刺计划，预先勾选 ${report.planStops.length} 个还没练到 3 题的专题。保存前可以再调整。`,
                      `Opens the Line 500 sprint plan with the ${report.planStops.length} stops you have solved fewer than 3 problems on already ticked. Adjust before you save.`,
                    )}
                  </p>
                  <a className="jd-plan-link" href={planHref(report.planStops)}>
                    {t('按缺口生成学习计划', 'Plan around my gaps')} →
                  </a>
                </>
              ) : (
                <p>
                  {gaps
                    ? t(
                        '这些缺口不在 500 路题单里：按每一项的“去练”链接补齐。',
                        'These gaps are not on Line 500: use each skill’s practice link.',
                      )
                    : unmeasured
                      ? t('本站能度量的各项都已就绪，可以开始模拟面试了。', 'Every skill CSWork can measure is ready. Time for a mock interview.')
                      : t('职位要求的各项都已就绪，可以开始模拟面试了。', 'Every skill this posting asks for is ready. Time for a mock interview.')}
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function SkillRow({ item, status, zh }: { item: JdItem; status: string; zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const info = JD_SKILL_INFO[item.skill];
  const name = zh ? info.zh : info.en;
  const unit = info.line
    ? t('个专题练到 3 题', 'stops with 3 solved')
    : info.stories
      ? t('个 STAR 故事', 'STAR stories')
      : info.parts
        ? t('章已读或题已过', 'chapters read or problems solved')
        : t('道题已通过', 'problems solved');
  return (
    <li className="jd-skill" data-status={item.status}>
      <div className="jd-skill-head">
        <strong>{name}</strong>
        <span className="jd-status">{status}</span>
      </div>
      {item.total > 0 ? (
        <div className="jd-progress">
          <span className="jd-bar" aria-hidden="true">
            <i style={{ width: `${Math.round((item.done / item.total) * 100)}%` }} />
          </span>
          <small>
            {item.done} / {item.total} {unit}
            {item.certified && t('（已获证书）', ' (certificate earned)')}
          </small>
        </div>
      ) : (
        <small>{t('本站还没有这项的练习，对照职位描述自查。', 'Nothing on CSWork measures this yet: check it against the posting yourself.')}</small>
      )}
      {item.evidence && <q className="jd-evidence">{item.evidence}</q>}
      {info.href && (
        <a href={info.href}>
          {t('去练', 'Practice')}
          <span className="sr-only"> {name}</span> →
        </a>
      )}
    </li>
  );
}
