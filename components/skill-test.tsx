'use client';
import { useEffect, useRef, useState } from 'react';
import { englishMessage } from '@/lib/messages-en';
import { archiveMock, finishMock, formatClock, readMockState, writeMockState } from '@/lib/mock-oa';
import { ojRequest } from '@/lib/oj-client';
import type { skillOverview } from '@/lib/server/skill-tests';
import {
  PASS_EACH,
  PASS_TOTAL,
  SKILL_COOLDOWN_DAYS,
  SKILL_TESTS,
  skillSession,
  skillTest,
  type SkillAttempt,
  type SkillTest,
} from '@/lib/skill-tests';
import { api } from '@/lib/types';

export type SkillOverview = ReturnType<typeof skillOverview>;

/**
 * /certify: the exams, their rules, the running one and past results, and the certificates
 * they (and the self-paced courses) issued. Starting puts the server's attempt in this browser
 * as the running mock OA session and opens the first question; handing in goes back here.
 */
export function SkillTests({
  initial,
  userId,
  verified,
  zh,
}: {
  /** Null when signed out. */
  initial: SkillOverview | null;
  userId: string | null;
  verified: boolean;
  zh: boolean;
}) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [data, setData] = useState(initial);
  // The server clock at the last fetch, against this browser's: exams count down to its deadline.
  const [clock, setClock] = useState(() => ({ server: initial?.now ?? Date.now(), client: Date.now() }));
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<SkillTest | null>(null);
  const [onProfile, setOnProfile] = useState<Record<string, boolean>>({});
  const confirmButton = useRef<HTMLButtonElement>(null);
  const serverNow = () => clock.server + (Date.now() - clock.client);
  const fail = (e: unknown) => {
    const message = (e as Error).message;
    setError(t(message, englishMessage(message)));
  };
  const refresh = () =>
    ojRequest<SkillOverview>('skills').then((next) => {
      setData(next);
      setClock({ server: next.now, client: Date.now() });
    }, fail);

  const running = data?.running ?? null;
  const judging = !!data?.attempts.some((a) => a.score === null && a.id !== running?.id);
  useEffect(() => {
    if (!running && !judging) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running, judging]);
  // The server's time as of the last tick.
  const at = clock.server + (now - clock.client);
  const runningLeft = running ? running.deadline - at : 0;
  // A verdict still judging, or the running exam past its deadline: ask again shortly.
  const due = judging || (!!running && runningLeft <= 0);
  useEffect(() => {
    if (!due) return;
    const timer = setTimeout(() => void refresh(), 5000);
    return () => clearTimeout(timer);
    // oxlint-disable-next-line react/react-compiler -- refresh is a fresh closure each render; new data re-arms the retry.
  }, [due, data]);
  useEffect(() => {
    if (confirm) confirmButton.current?.focus();
  }, [confirm]);

  /** Puts the attempt in this browser as the running mock session and opens its first question. */
  function openExam(attempt: SkillAttempt, at: number) {
    const test = skillTest(attempt.test);
    if (!test || !userId) return;
    const session = skillSession(attempt, test, at, Date.now(), zh);
    const state = readMockState(userId);
    // A mock OA still on the clock is handed in as it stands, as a new mock draw would.
    const base =
      state.active?.startedAt && state.active.id !== attempt.id
        ? archiveMock(state, finishMock(state.active, Date.now()))
        : state;
    if (!writeMockState(userId, { ...base, active: session })) {
      setError(
        t(
          '浏览器存储不可用，无法进入考试界面。请退出无痕模式后再试；考试仍在服务器上计时。',
          "Browser storage is unavailable, so the exam view can't open. Leave private browsing and try again; the exam is still timed on the server.",
        ),
      );
      return;
    }
    location.assign(`/?${new URLSearchParams({ view: 'problem', problem: attempt.ids[0], mock: attempt.id })}`);
  }

  async function start(test: SkillTest) {
    setConfirm(null);
    setBusy(test.id);
    setError('');
    try {
      const { attempt, now: at } = await ojRequest<{ attempt: SkillAttempt; now: number }>(`skills/${test.id}/start`, {});
      openExam(attempt, at);
    } catch (e) {
      fail(e);
      await refresh();
    } finally {
      setBusy('');
    }
  }

  async function handIn(attempt: SkillAttempt) {
    setBusy('finish');
    setError('');
    try {
      await ojRequest(`skills/${attempt.test}/finish`, {});
      if (userId) {
        const state = readMockState(userId);
        if (state.active?.id === attempt.id) writeMockState(userId, archiveMock(state, state.active));
      }
    } catch (e) {
      fail(e);
    } finally {
      await refresh();
      setBusy('');
    }
  }

  const date = (at: number) =>
    new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(at);
  const title = (id: string) => {
    const test = skillTest(id);
    return test ? t(test.zh, test.en) : id;
  };
  const certificateOf = (id: string) => data?.certificates.find((c) => c.courseId === `skill:${id}`);

  return (
    <div className="certify">
      {error && (
        <p className="certify-alert" role="alert">
          {error}
        </p>
      )}
      {running && (
        <section className="certify-live" aria-labelledby="certify-live-title">
          <div>
            <p className="certify-kicker">{t('考试进行中', 'Exam in progress')}</p>
            <h2 id="certify-live-title">{title(running.test)}</h2>
            <p>
              {t(`共 ${running.ids.length} 题，题解、提示和 AI 助教在交卷前关闭。`, `${running.ids.length} questions. Editorials, hints and the AI tutor stay closed until you hand in.`)}
            </p>
          </div>
          <span className="certify-live-clock" role="timer" aria-label={t('剩余时间', 'Time left')}>
            {formatClock(runningLeft)}
          </span>
          <div className="certify-live-actions">
            <button type="button" className="certify-primary" onClick={() => openExam(running, serverNow())}>
              {t('继续作答', 'Back to the exam')}
            </button>
            <button type="button" className="certify-quiet" disabled={busy === 'finish'} onClick={() => void handIn(running)}>
              {t('交卷', 'Hand in')}
            </button>
          </div>
        </section>
      )}

      <section aria-labelledby="certify-tests-title">
        <h2 id="certify-tests-title" className="certify-section-title">
          {t('四项认证', 'Four exams')}
        </h2>
        <ol className="certify-tickets">
          {SKILL_TESTS.map((test, i) => {
            const nextAt = data?.nextAt[test.id] ?? null;
            const cooling = nextAt !== null && nextAt > at;
            const cert = certificateOf(test.id);
            const last = data?.attempts.find((a) => a.test === test.id);
            return (
              <li key={test.id} className="certify-ticket" style={{ '--i': i } as React.CSSProperties} data-passed={cert ? '' : undefined}>
                <div className="certify-ticket-body">
                  <p className="certify-ticket-no">{`No. 0${i + 1}`}</p>
                  <h3>{t(test.zh, test.en)}</h3>
                  <p className="certify-ticket-pool">{t(test.poolZh, test.poolEn)}</p>
                  {last && last.score !== null && (
                    <p className="certify-ticket-last">
                      {t('上次', 'Last')} {date(last.startedAt)} · {last.score}/{last.max} ·{' '}
                      {last.passed ? t('通过', 'passed') : t('未通过', 'not passed')}
                    </p>
                  )}
                  {cert && (
                    <a className="certify-stamp" href={`/certificate/${cert.id}`}>
                      {t('已认证 · 查看证书', 'Certified · view certificate')}
                    </a>
                  )}
                </div>
                <div className="certify-ticket-stub">
                  <strong>{test.minutes}</strong>
                  <span>{t('分钟', 'min')}</span>
                  <strong>{test.slots.length}</strong>
                  <span>{t('题', 'questions')}</span>
                  {test.language === 'python' && <em>{t('仅 Python', 'Python only')}</em>}
                  {!userId ? (
                    <a className="certify-primary" href="/?view=account">
                      {t('登录后开考', 'Sign in to start')}
                    </a>
                  ) : confirm === test ? (
                    <div className="certify-confirm" role="group" aria-label={t('确认开考', 'Confirm the start')}>
                      <p>
                        {t(
                          `计时 ${test.minutes} 分钟立即开始，${SKILL_COOLDOWN_DAYS} 天内不能重考。`,
                          `The ${test.minutes}-minute clock starts at once; no retake for ${SKILL_COOLDOWN_DAYS} days.`,
                        )}
                      </p>
                      <button ref={confirmButton} type="button" className="certify-primary" onClick={() => void start(test)}>
                        {t('开考', 'Start')}
                      </button>
                      <button type="button" className="certify-quiet" onClick={() => setConfirm(null)}>
                        {t('取消', 'Cancel')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="certify-primary"
                      disabled={!verified || !!running || cooling || !!busy}
                      onClick={() => setConfirm(test)}
                    >
                      {busy === test.id ? t('抽题中…', 'Drawing…') : t('开始考试', 'Start exam')}
                    </button>
                  )}
                  {cooling && nextAt !== null && (
                    <small>
                      {t('下次可考', 'Opens again')} {date(nextAt)}
                    </small>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {userId && !verified && (
          <p className="certify-note">
            {t('验证邮箱后才能开考。', 'Verify your email to take an exam.')} <a href="/?view=account">{t('去验证', 'Verify now')}</a>
          </p>
        )}
      </section>

      <section className="certify-rules" aria-labelledby="certify-rules-title">
        <h2 id="certify-rules-title" className="certify-section-title">
          {t('规则', 'Rules')}
        </h2>
        <ul>
          <li>
            {t(
              '题目由服务器在开考时抽取，只从你还没通过的题里抽；计时也以服务器为准，到点自动交卷。',
              'The server draws the questions when you start, only from problems you have not solved yet, and keeps the time: the exam hands itself in at the deadline.',
            )}
          </li>
          <li>
            {t(
              `按测试点计分：每题 0–100 分，总分达到 ${PASS_TOTAL * 100}% 且每题不低于 ${PASS_EACH * 100}% 即通过。只计开考到交卷之间的正式提交。`,
              `Scored by tests passed: each question 0–100. Pass with ${PASS_TOTAL * 100}% overall and at least ${PASS_EACH * 100}% on every question. Only formal submissions between the start and the hand-in count.`,
            )}
          </li>
          <li>
            {t(
              '考试期间，这些题的题解、提示、讨论和 AI 助教都会关闭，交卷后恢复。',
              'During the exam, editorials, hints, discussions and the AI tutor are closed for its questions; they reopen once you hand in.',
            )}
          </li>
          <li>
            {t(
              `同一项认证 ${SKILL_COOLDOWN_DAYS} 天内只能考一次；同一时间只能进行一场。`,
              `Each exam once per ${SKILL_COOLDOWN_DAYS} days, and one exam at a time.`,
            )}
          </li>
          <li>
            {t(
              '证书是 CSWork 站内认证，记录你在本站限时考试中的成绩，不是学历或职业资格证明。',
              'Certificates are CSWork’s own: they record a timed exam taken on this site, not a degree or a professional qualification.',
            )}
          </li>
        </ul>
      </section>

      {userId && data && data.attempts.length > 0 && (
        <section aria-labelledby="certify-history-title">
          <h2 id="certify-history-title" className="certify-section-title">
            {t('考试记录', 'Your attempts')}
          </h2>
          <table className="certify-history">
            <thead>
              <tr>
                <th scope="col">{t('认证', 'Exam')}</th>
                <th scope="col">{t('开考时间', 'Started')}</th>
                <th scope="col">{t('成绩', 'Score')}</th>
              </tr>
            </thead>
            <tbody>
              {data.attempts.map((a) => (
                <tr key={a.id}>
                  <td>{title(a.test)}</td>
                  <td>{date(a.startedAt)}</td>
                  <td data-result={a.passed === null ? 'open' : a.passed ? 'passed' : 'failed'}>
                    {a.id === running?.id
                      ? t('进行中', 'In progress')
                      : a.score === null
                        ? t('评分中…', 'Scoring…')
                        : `${a.score}/${a.max} · ${a.passed ? t('通过', 'Passed') : t('未通过', 'Not passed')}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {userId && data && data.certificates.length > 0 && (
        <section aria-labelledby="certify-certs-title">
          <h2 id="certify-certs-title" className="certify-section-title">
            {t('我的证书', 'Your certificates')}
          </h2>
          <ul className="certify-certs">
            {data.certificates.map((c) => (
              <li key={c.id}>
                <a href={`/certificate/${c.id}`}>
                  <span>{c.skill ? t('技能认证', 'Skill certification') : t('课程结业', 'Course completion')}</span>
                  {t(c.zh, c.en)}
                </a>
                <label>
                  <input
                    type="checkbox"
                    disabled={busy === c.id}
                    checked={onProfile[c.id] ?? !!c.onProfile}
                    onChange={async (e) => {
                      const on = e.target.checked;
                      setBusy(c.id);
                      setError('');
                      try {
                        await api(`certificates/${c.id}`, { onProfile: on });
                        setOnProfile((m) => ({ ...m, [c.id]: on }));
                      } catch (err) {
                        fail(err);
                      } finally {
                        setBusy('');
                      }
                    }}
                  />
                  {t('在公开主页展示（会显示账号名称）', 'Show on my public profile (shows your account name)')}
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
