'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { McqItem } from '@/components/oa-mcq';
import { MCQ_LOCAL_KEY, putReview } from '@/app/oa/mcq/practice';
import {
  APT_GROUPS,
  APT_KIND_NAMES,
  SPEED,
  SPEED_KEY,
  SPEED_SECTION_NAMES,
  aptKind,
  aptReview,
  aptSection,
  aptitudeById,
  newSpeed,
  paceReport,
  parseSpeed,
  scoreSpeed,
  speedDeadline,
  speedSet,
  speedSettle,
  speedStep,
  type AptKind,
  type SpeedState,
} from '@/lib/aptitude';
import { formatClock, mcqDay, mcqRight, parseMcqReview, readMockState, type McqReview } from '@/lib/mock-oa';

const NOTE = `/api/oj/notes?target=${encodeURIComponent('mcq:answers')}`;
const newSeed = () => Math.floor(Math.random() * 2 ** 32);
type T = (zh: string, en: string) => string;
type Miss = { id: string; answer: number[]; picks: number[] };

/**
 * Writes misses to the multiple-choice review (lib/aptitude.ts aptReview): signed in, the account
 * note, read first so a review saved elsewhere is not overwritten; signed out, this browser's
 * review, which /oa/mcq moves to the account on the next signed-in visit. One save at a time.
 */
let saving = Promise.resolve(true);
function saveMisses(viewer: string, misses: Miss[]) {
  const apply = (review: McqReview) => misses.reduce((acc, m) => aptReview(acc, m.id, m.answer, m.picks, mcqDay()), review);
  return (saving = saving.then(async () => {
    if (!misses.length) return true;
    if (!viewer)
      try {
        localStorage.setItem(MCQ_LOCAL_KEY, JSON.stringify(apply(parseMcqReview(localStorage.getItem(MCQ_LOCAL_KEY)))));
        return true;
      } catch {
        return false;
      }
    try {
      const response = await fetch(NOTE);
      if (!response.ok) return false;
      return await putReview(apply(parseMcqReview((await response.json())?.body)));
    } catch {
      return false;
    }
  }));
}
const readSpeed = () => {
  try {
    return parseSpeed(localStorage.getItem(SPEED_KEY));
  } catch {
    return null;
  }
};
const writeSpeed = (s: SpeedState | null) => {
  try {
    if (s) localStorage.setItem(SPEED_KEY, JSON.stringify(s));
    else localStorage.removeItem(SPEED_KEY);
  } catch {}
};

/**
 * /oa/aptitude: practice by kind, or the 50-question speed test. While a test runs only the
 * current question shows: no practice tab, no explanations and no formula sheet (`children`).
 * A running mock OA hides everything, as the review session does.
 */
export function AptitudePractice({ zh, viewer, children }: { zh: boolean; viewer: string; children?: React.ReactNode }) {
  const t: T = (a, b) => (zh ? a : b);
  const [mock, setMock] = useState(false);
  const [tab, setTab] = useState<'drill' | 'speed'>('drill');
  const [speed, setSpeed] = useState<SpeedState | null>(null);
  useEffect(() => {
    setMock(!!viewer && !!readMockState(viewer).active);
    const stored = readSpeed();
    if (!stored) return;
    const settled = speedSettle(stored, Date.now());
    writeSpeed(settled);
    setSpeed(settled);
    setTab('speed');
  }, [viewer]);
  const keep = (next: SpeedState | null) => {
    writeSpeed(next);
    setSpeed(next);
  };
  if (mock)
    return (
      <p className="apt-state" role="status">
        {t(
          '模拟 OA 进行中：交卷或到时后再来练习。考试期间能力测评题和公式速查都不显示。',
          'A mock OA is in progress. Come back once it is submitted or over: aptitude questions and the formula sheet stay hidden during it.',
        )}
      </p>
    );
  const locked = !!speed && !speed.finishedAt;
  return (
    <>
      {!locked && (
        <div className="apt-tabs" role="tablist" aria-label={t('练习方式', 'Practice mode')}>
          {(
            [
              ['drill', t('分科练习', 'Practice by kind')],
              ['speed', t('50 题速度测验', '50-question speed test')],
            ] as const
          ).map(([key, label]) => (
            <button key={key} id={`apt-tab-${key}`} type="button" role="tab" aria-selected={tab === key} aria-controls="apt-panel" onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>
      )}
      <div id="apt-panel" role={locked ? undefined : 'tabpanel'} aria-labelledby={locked ? undefined : `apt-tab-${tab}`}>
        {tab === 'drill' && !locked ? <Drill t={t} zh={zh} viewer={viewer} /> : <Speed t={t} zh={zh} viewer={viewer} speed={speed} keep={keep} />}
      </div>
      {!locked && children}
    </>
  );
}

function Drill({ t, zh, viewer }: { t: T; zh: boolean; viewer: string }) {
  const [kind, setKind] = useState<AptKind>('percent');
  const [seed, setSeed] = useState<number | null>(null);
  const [picks, setPicks] = useState<number[]>([]);
  const [shown, setShown] = useState(false);
  const [tally, setTally] = useState({ right: 0, done: 0 });
  const [failed, setFailed] = useState(false);
  // The seed is drawn in the browser only, so the server and the first render agree.
  useEffect(() => setSeed(newSeed()), []);
  const q = useMemo(() => (seed === null ? null : aptitudeById(`apt-${kind}-${seed}`)), [kind, seed]);
  useEffect(() => {
    if (seed !== null && !q) setSeed(newSeed());
  }, [seed, q]);
  const next = (k: AptKind) => {
    setKind(k);
    setSeed(newSeed());
    setPicks([]);
    setShown(false);
  };
  return (
    <section className="apt-drill" aria-label={t('分科练习', 'Practice by kind')}>
      <div className="oa-mcq-filters">
        {APT_GROUPS.map((g) => (
          <fieldset key={g.topic}>
            <legend>{t(...g.name)}</legend>
            {g.kinds.map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => next(k)}>
                {t(...APT_KIND_NAMES[k])}
              </button>
            ))}
          </fieldset>
        ))}
      </div>
      <p className="oa-mcq-score">
        <output aria-live="polite">
          {tally.done
            ? t(`本次已做 ${tally.done} 题 · 答对 ${tally.right}`, `${tally.done} answered this visit · ${tally.right} correct`)
            : t('每道题都按规则现场生成，做不完。', 'Questions are generated on the spot; they never run out.')}
        </output>
      </p>
      {q && (
        <McqItem key={q.id} q={q} text={zh ? q.zh : q.en} n={tally.done + (shown ? 0 : 1)} zh={zh} picks={picks} onPick={setPicks} reveal={shown}>
          <div className="oa-mcq-actions">
            {shown ? (
              <button type="button" onClick={() => next(kind)}>
                {t('下一题', 'Next question')}
              </button>
            ) : (
              <button
                type="button"
                aria-disabled={!picks.length || undefined}
                onClick={() => {
                  if (!picks.length) return;
                  setShown(true);
                  const right = mcqRight(q.answer, picks);
                  setTally((s) => ({ right: s.right + Number(right), done: s.done + 1 }));
                  // ponytail: only misses are saved; a fresh random seed is never already in the review.
                  if (!right) void saveMisses(viewer, [{ id: q.id, answer: q.answer, picks }]).then((ok) => setFailed(!ok));
                }}
              >
                {t('提交', 'Submit')}
              </button>
            )}
          </div>
        </McqItem>
      )}
      <p className="oa-mcq-note">
        {viewer
          ? t('答错的题进入你账号里的选择题复习，第二天在「今日复习」里再出现。', 'Missed questions go into the multiple-choice review in your account and come back the next day in your review session.')
          : t('答错的题先存在这台设备的浏览器里；登录后打开 OA 选择题练习页，会存进账号的复习。', 'Missed questions stay in this browser for now; open OA multiple-choice practice signed in to move them into your account’s review.')}
        {failed && <span role="alert"> {t('最近一次保存失败。', 'The last save failed.')}</span>}
      </p>
    </section>
  );
}

const secs = (ms: number) => (ms / 1000).toFixed(1);

function Speed({ t, zh, viewer, speed, keep }: { t: T; zh: boolean; viewer: string; speed: SpeedState | null; keep: (s: SpeedState | null) => void }) {
  const [negative, setNegative] = useState(false);
  const [sectioned, setSectioned] = useState(false);
  const [now, setNow] = useState(0);
  const [saveFailed, setSaveFailed] = useState(false);
  const seed = speed?.seed;
  const split = speed?.sectioned;
  const ids = useMemo(() => (seed === undefined ? [] : speedSet(seed, split)), [seed, split]);
  const questions = useMemo(() => ids.map((id) => aptitudeById(id)!), [ids]);
  const current = useRef(speed);
  current.current = speed;
  const running = !!speed && !speed.finishedAt;

  const choose = (pick: number) => {
    const s = current.current;
    if (!s || s.finishedAt) return;
    const picks = [...s.picks];
    picks[s.at] = pick;
    keep({ ...s, picks });
  };
  /** Next (with the current pick) or Skip (none); a clock that already ran out wins. */
  const advance = (skip: boolean) => {
    const s = current.current;
    if (!s || s.finishedAt) return;
    const at = Date.now();
    const settled = speedSettle(s, at);
    if (settled !== s) return keep(settled);
    if (!skip && s.picks[s.at] === null) return;
    const picks = [...s.picks];
    if (skip) picks[s.at] = null;
    keep(speedStep({ ...s, picks }, at));
  };
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      const at = Date.now();
      setNow(at);
      const s = current.current;
      const settled = s && speedSettle(s, at);
      if (settled && settled !== s) keep(settled);
    }, 500);
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (/^[1-4]$/.test(e.key)) {
        e.preventDefault();
        choose(Number(e.key) - 1);
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        advance(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearInterval(timer);
      window.removeEventListener('keydown', onKey);
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- the handlers read the latest state from `current`.
  }, [running]);
  // Handed in: the misses go to the review once.
  const finished = !!speed?.finishedAt;
  const saved = !!speed?.saved;
  useEffect(() => {
    const s = current.current;
    if (!s || !finished || saved) return;
    const misses = ids.flatMap((id, i) => {
      const pick = s.picks[i];
      return pick !== null && pick !== questions[i].answer[0] ? [{ id, answer: questions[i].answer, picks: [pick] }] : [];
    });
    void saveMisses(viewer, misses).then((ok) => {
      setSaveFailed(!ok);
      const latest = current.current;
      if (ok && latest?.seed === s.seed && latest.finishedAt) keep({ ...latest, saved: true });
    });
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once per hand-in.
  }, [finished, saved, ids, questions, viewer]);

  if (!speed) {
    const budget = SPEED.sections.map((n, i) => `${t(...SPEED_SECTION_NAMES[i])} ${n} ${t('题', 'Q')} ${formatClock(n * SPEED.perQ)}`).join(t('；', '; '));
    return (
      <section className="apt-speed" aria-labelledby="apt-speed-title">
        <h2 id="apt-speed-title">{t('50 题 15 分钟速度测验', '50 questions in 15 minutes')}</h2>
        <ul className="apt-rules">
          <li>{t('数量与图表 18 题、逻辑 18 题、图形 14 题，平均每题 18 秒。多数人做不完，这很正常。', '18 numbers-and-charts, 18 logic and 14 figure questions: 18 seconds each on average. Most people do not finish, and that is expected.')}</li>
          <li>{t('一次只显示一题，只有「下一题」和「跳过」，做过的题不能回看。按 1–4 选答案，按 Enter 进入下一题。', 'One question at a time, with only Next and Skip: you cannot go back. Press 1–4 to pick and Enter for the next question.')}</li>
          <li>{t('刷新页面后从当前题接着做，时钟不停；时间到自动交卷。', 'A reload brings you back to the current question with the clock still running; time up hands the test in.')}</li>
        </ul>
        <div className="apt-options">
          <label>
            <input type="checkbox" checked={negative} onChange={(e) => setNegative(e.target.checked)} />
            {t('倒扣分：答错扣 1/3 分（四选一乱猜的期望得分是 0），跳过不扣分', 'Negative marking: a wrong answer costs 1/3 (so random guessing averages 0); skipping costs nothing')}
          </label>
          <label>
            <input type="checkbox" checked={sectioned} onChange={(e) => setSectioned(e.target.checked)} />
            {t(`分区限时（${budget}），剩下的时间不带到下一区`, `Timed sections (${budget}); time left in a section does not carry over`)}
          </label>
        </div>
        <div className="oa-mcq-actions">
          <button type="button" onClick={() => keep(newSpeed(newSeed(), negative, sectioned, Date.now()))}>
            {t('开始测验', 'Start the test')}
          </button>
        </div>
        <p className="oa-mcq-note">{t('进度只保存在这台设备的浏览器里；交卷后答错的题进入选择题复习。', 'Progress stays in this browser; once handed in, missed questions go into the multiple-choice review.')}</p>
      </section>
    );
  }

  if (running) {
    const q = questions[speed.at];
    const pick = speed.picks[speed.at];
    const sec = aptSection(ids[speed.at]);
    return (
      <section className="apt-speed" aria-label={t('速度测验进行中', 'Speed test in progress')}>
        <div className="apt-bar-top">
          <span role="timer" aria-live="off" className="apt-clock">
            {formatClock(speedDeadline(speed) - Math.max(now, speed.shownAt))}
          </span>
          <span>{t(`第 ${speed.at + 1} / ${SPEED.count} 题`, `Question ${speed.at + 1} of ${SPEED.count}`)}</span>
          {speed.sectioned && <span>{t(`本区：${SPEED_SECTION_NAMES[sec][0]}`, `Section: ${SPEED_SECTION_NAMES[sec][1]}`)}</span>}
          {speed.negative && <span>{t('倒扣分', 'Negative marking')}</span>}
        </div>
        <McqItem key={q.id} q={q} text={zh ? q.zh : q.en} n={speed.at + 1} zh={zh} picks={pick === null ? [] : [pick]} onPick={(p) => choose(p[0])} reveal={false}>
          <div className="oa-mcq-actions">
            <button type="button" aria-disabled={pick === null || undefined} onClick={() => advance(false)}>
              {speed.at + 1 < SPEED.count ? t('下一题', 'Next') : t('交卷', 'Hand in')}
            </button>
            <button type="button" className="is-quiet" onClick={() => advance(true)}>
              {t('跳过', 'Skip')}
            </button>
          </div>
        </McqItem>
        <p className="oa-mcq-note">{t('按 1–4 选择，Enter 下一题。做过的题不能回看。', 'Press 1–4 to pick and Enter to go on. You cannot go back.')}</p>
      </section>
    );
  }

  return <SpeedResult t={t} zh={zh} speed={speed} ids={ids} saveFailed={saveFailed} onReset={() => keep(null)} />;
}

const RESULT_NAMES: Record<'right' | 'wrong' | 'skipped' | 'unreached', [string, string]> = {
  right: ['答对', 'right'],
  wrong: ['答错', 'wrong'],
  skipped: ['跳过', 'skipped'],
  unreached: ['没做到', 'not reached'],
};

function SpeedResult({ t, zh, speed, ids, saveFailed, onReset }: { t: T; zh: boolean; speed: SpeedState; ids: string[]; saveFailed: boolean; onReset: () => void }) {
  const questions = ids.map((id) => aptitudeById(id)!);
  const score = scoreSpeed(ids, speed.picks, speed.negative);
  const pace = paceReport(ids, speed.picks, speed.ms);
  const state = (i: number) =>
    speed.ms[i] === null ? 'unreached' : speed.picks[i] === null ? 'skipped' : speed.picks[i] === questions[i].answer[0] ? 'right' : 'wrong';
  const top = Math.max(54_000, ...speed.ms.map((m) => m ?? 0));
  const y = (ms: number) => 140 - (ms / top) * 120;
  const kinds = (list: AptKind[]) => list.map((k) => t(...APT_KIND_NAMES[k])).join(t('、', ', '));
  const advice = {
    'out-of-time': t(
      `还有 ${pace.unreached} 题没来得及看。速度测验做不完是常态，但一题卡到 36 秒（两倍平均）还没头绪，就该跳过，把时间留给后面会做的题。`,
      `${pace.unreached} question${pace.unreached === 1 ? ' was' : 's were'} never reached. Few people finish, but a question with no way in by 36 seconds (twice the pace) is one to skip, leaving the time for ones you can do.`,
    ),
    'skip-sooner': t(
      `有 ${pace.slowWrong.length} 题用了 36 秒以上还是答错了（${pace.slowWrong.map((i) => `Q${i + 1}`).join('、')}）。这种题最该早点跳过。`,
      `${pace.slowWrong.length} question${pace.slowWrong.length === 1 ? '' : 's'} took over 36 seconds and still went wrong (${pace.slowWrong.map((i) => `Q${i + 1}`).join(', ')}). Those are the ones to skip sooner.`,
    ),
    'drill-kinds': t(
      `这几类题平均超过 27 秒：${kinds(pace.slowKinds)}。去「分科练习」多做几组，先求熟再求快。`,
      `These kinds averaged over 27 seconds: ${kinds(pace.slowKinds)}. Do a few rounds of each under Practice by kind.`,
    ),
    'on-pace': t('节奏不错：没有题拖得太久，也都做到了。', 'Good pace: nothing dragged on, and you reached every question.'),
  };
  const net = Number.isInteger(score.net) ? String(score.net) : score.net.toFixed(1);
  return (
    <section className="apt-speed" aria-labelledby="apt-result-title">
      <h2 id="apt-result-title">{t('测验结果', 'Your result')}</h2>
      <dl className="apt-result">
        <div>
          <dt>{speed.negative ? t('净分（答错扣 1/3）', 'Net score (−1/3 per miss)') : t('得分', 'Score')}</dt>
          <dd>
            {net} / {SPEED.count}
          </dd>
        </div>
        <div>
          <dt>{t('对 / 错 / 未答', 'Right / wrong / unanswered')}</dt>
          <dd>
            {score.correct} / {score.wrong} / {score.skipped}
          </dd>
        </div>
        {pace.sections.map((s, i) => (
          <div key={i}>
            <dt>{t(...SPEED_SECTION_NAMES[i])}</dt>
            <dd>{s.shown ? t(`平均 ${s.avg.toFixed(1)} 秒/题（做了 ${s.shown} 题）`, `${s.avg.toFixed(1)} s per question (${s.shown} seen)`) : t('没做到', 'Not reached')}</dd>
          </div>
        ))}
      </dl>
      <figure className="apt-pace">
        <svg viewBox="0 0 520 170" role="img" aria-label={t('每题用时柱状图，18 秒处是平均节奏线；逐题数据见下方表格。', 'Seconds per question, with the 18-second pace line; the table below has every value.')}>
          <line x1="28" y1={y(SPEED.perQ)} x2="512" y2={y(SPEED.perQ)} className="apt-pace-line" />
          <text x="2" y={y(SPEED.perQ) + 3} className="apt-axis">18s</text>
          <line x1="28" y1="140" x2="512" y2="140" className="apt-axis-line" />
          {ids.map((id, i) => {
            const ms = speed.ms[i];
            if (ms === null) return null;
            const x = 32 + i * 9.6;
            const s = state(i);
            return (
              <g key={id}>
                <rect x={x} y={y(ms)} width="6" height={140 - y(ms)} className="apt-pace-bar" />
                {s === 'right' && <circle cx={x + 3} cy={y(ms) - 6} r="3" className="apt-mark-right" />}
                {s === 'wrong' && <path d={`M${x} ${y(ms) - 9}l6 6m0 -6l-6 6`} className="apt-mark-wrong" />}
                {s === 'skipped' && <rect x={x + 0.5} y={y(ms) - 9} width="5" height="5" className="apt-mark-skip" />}
              </g>
            );
          })}
          {[1, 10, 20, 30, 40, 50].map((n) => (
            <text key={n} x={32 + (n - 1) * 9.6 + 3} y="155" textAnchor="middle" className="apt-axis">
              {n}
            </text>
          ))}
        </svg>
        <figcaption>
          <span className="apt-key-right" aria-hidden="true">●</span> {t('答对', 'right')} <span className="apt-key-wrong" aria-hidden="true">✕</span> {t('答错', 'wrong')}{' '}
          <span aria-hidden="true">□</span> {t('跳过', 'skipped')} · {t('虚线 = 18 秒', 'dashed line = 18 s')}
        </figcaption>
      </figure>
      <details className="apt-table">
        <summary>{t('每题用时表', 'Time per question (table)')}</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">{t('题型', 'Kind')}</th>
              <th scope="col">{t('用时（秒）', 'Seconds')}</th>
              <th scope="col">{t('结果', 'Result')}</th>
            </tr>
          </thead>
          <tbody>
            {ids.map((id, i) => (
              <tr key={id}>
                <th scope="row">{i + 1}</th>
                <td>{t(...APT_KIND_NAMES[aptKind(id)!])}</td>
                <td>{speed.ms[i] === null ? '—' : secs(speed.ms[i]!)}</td>
                <td>{t(...RESULT_NAMES[state(i)])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <h3>{t('节奏建议', 'Pacing')}</h3>
      <ul className="apt-rules">
        {pace.advice.map((a) => (
          <li key={a}>{advice[a]}</li>
        ))}
      </ul>
      <p className="oa-mcq-note">
        {score.wrong ? t('答错的题已进入选择题复习。', 'Missed questions are now in your multiple-choice review.') : ''}
        {saveFailed && <span role="alert"> {t('错题保存失败，刷新页面会再试一次。', 'Saving the misses failed; a reload tries again.')}</span>}
      </p>
      <details className="apt-review">
        <summary>{t('逐题解析', 'Every question with its explanation')}</summary>
        <ol className="oa-mcq-list">
          {questions.map((q, i) => (
            <li key={q.id}>
              <McqItem q={q} text={zh ? q.zh : q.en} n={i + 1} zh={zh} picks={speed.picks[i] === null ? [] : [speed.picks[i]!]} onPick={() => {}} reveal />
            </li>
          ))}
        </ol>
      </details>
      <div className="oa-mcq-actions">
        <button type="button" onClick={onReset}>
          {t('再测一次', 'Take a new test')}
        </button>
      </div>
    </section>
  );
}
