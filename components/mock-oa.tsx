'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  EyeOff,
  Flag,
  Info,
  LoaderCircle,
  RotateCcw,
  Search,
  Shuffle,
  Timer,
} from 'lucide-react';
import { Button } from './ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { LibrarySwitch } from './algorithm-library';
import type { Navigate } from './learning';
import { useLocale, useT } from '@/lib/i18n';
import { track } from '@/lib/analytics';
import { englishMessage } from '@/lib/messages-en';
import { ojRequest, verdict } from '@/lib/oj-client';
import { problemTitle } from '@/lib/problems';
import { companyInitials, companyLogos } from '@/lib/oa-company-brands';
import { STOP_NAMES, stopHref, topicName } from '@/lib/route-stops';
import type { Boot } from '@/lib/types';
import {
  archiveMock,
  drawMcq,
  extraSections,
  findMock,
  finishMcq,
  finishMock,
  formatClock,
  LADDER,
  mockCert,
  mockClock,
  readMockState,
  reportLevel,
  reportWindow,
  scoreMcq,
  watchMockState,
  writeMockState,
  type McqConfig,
  type McqQuestion,
  type MockSession,
  type MockSource,
  type MockState,
  type QuestionResult,
  type Scoring,
  type Slot,
} from '@/lib/mock-oa';
import { syncMockHistory, uploadMocks } from '@/lib/mock-cloud';
import { pruneTracks } from '@/lib/mock-replay';
import { MockReplay } from './mock-replay';
import { handInSkill } from './mock-exam-bar';
import { loadMcqBank, McqItem } from './oa-mcq';
import '@/app/mock-oa.css';

type Preset = {
  slug: string;
  name: string;
  platform: string;
  questions: number;
  minutes: number;
  slots: Slot[];
  scoring: Scoring;
  sections_zh: string;
  sections_en: string;
  notes_zh: string;
  notes_en: string;
  /** Weighted 0–1, heaviest first. */
  topics: { slug: string; weight: number }[];
  focus_zh: string;
  focus_en: string;
  style_zh: string;
  style_en: string;
  tips_zh: string;
  tips_en: string;
  evidence: string;
  pool: { oa: number; lc: number; total: number };
  /** The real OA's MCQ section, when it has one. */
  mcq?: McqConfig;
};
type Presets = {
  companies: Preset[];
  others: { slug: string; name: string; pool: Preset['pool'] }[];
  all: { oa: number; lc: number };
};
type Drawn = {
  ids: string[];
  company: string | null;
  name: string | null;
  platform: string | null;
  preset: boolean;
  minutes: number;
  slots: Slot[];
  scoring: Scoring;
  source: MockSource;
  topics?: string[];
  experience?: string;
  now: number;
};
type DrawRequest =
  | { company: string }
  | { experience: string }
  | {
      custom: {
        company?: string;
        questions: number;
        minutes: number;
        slots: Slot[];
        source: MockSource;
        topics?: string[];
      };
    };
type Report = {
  items: {
    id: string;
    attempts: number;
    best: QuestionResult | null;
    firstAcceptedMs: number | null;
    pending: boolean;
    /** An OA problem's estimated difficulty (lib/content/oa-topics.json). */
    estimate?: Slot | null;
  }[];
  score: { value: number; min: number; max: number; per: number[]; estimate: boolean };
  pending: boolean;
  /** Other learners' best in the same scenario scored below this (lib/server/mock-oa.ts mockPeers). */
  peers?: { n: number; below: number } | null;
};

const LEVEL: Record<Slot, [string, string]> = {
  easy: ['易', 'E'],
  medium: ['中', 'M'],
  hard: ['难', 'H'],
};
const LEVEL_NAME: Record<Slot, [string, string]> = {
  easy: ['简单', 'Easy'],
  medium: ['中等', 'Medium'],
  hard: ['困难', 'Hard'],
};
const MINUTES = [15, 30, 45, 60, 70, 75, 90, 120, 150, 180];
const platformKey = (platform: string | null) =>
  (platform || '').split(/[\s/]/)[0].toLowerCase();
/** Ids from the running mock and the last five, so a new draw brings fresh problems. */
const recentIds = (state: MockState) =>
  [state.active, ...state.history.slice(0, 5)].flatMap((s) => s?.ids ?? []);
const drawRequest = (s: MockSession): DrawRequest =>
  s.experience
    ? { experience: s.experience }
    : s.preset && s.company
    ? { company: s.company }
    : {
        custom: {
          ...(s.company ? { company: s.company } : {}),
          questions: s.ids.length,
          minutes: s.minutes,
          slots: s.slots,
          source: s.source,
          ...(s.topics?.length ? { topics: s.topics } : {}),
        },
      };

function Logo({ slug, name }: { slug: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const asset = slug && Object.hasOwn(companyLogos, slug) ? companyLogos[slug] : null;
  return (
    <span className="mock-logo" aria-hidden="true">
      {asset && !failed ? (
        // oxlint-disable-next-line nextjs/no-img-element -- Small local SVG logos, decorative next to the company name.
        <img src={asset} alt="" width={22} height={22} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        companyInitials(name.split(' / ')[0])
      )}
    </span>
  );
}

/** Difficulty slots drawn as stops on a line. */
function Stops({ slots, zh }: { slots: Slot[]; zh: boolean }) {
  return (
    <ol
      className="mock-stops"
      aria-label={(zh ? '难度：' : 'Difficulty: ') + slots.map((s) => LEVEL_NAME[s][zh ? 0 : 1]).join(zh ? '、' : ', ')}
    >
      {slots.map((s, i) => (
        <li key={i} data-level={s} aria-hidden="true">
          <i />
          <span>{LEVEL[s][zh ? 0 : 1]}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Timed mock OA (?view=mock): the company board, check-in (&session=) and the
 * score report (&report=). The running session lives in this browser; finished
 * ones also follow the account (lib/mock-cloud.ts).
 */
export function MockOa({
  boot,
  params,
  navigate,
}: {
  boot: Boot;
  params: Record<string, string>;
  navigate: Navigate;
}) {
  const t = useT();
  const userId = boot.person?.id || 'guest';
  const [state, setState] = useState<MockState>(() => readMockState(userId));
  const [storageFailed, setStorageFailed] = useState(false);
  /** Changes the stored state as it is now (another tab may have written since); null when not saved. */
  const save = (change: (latest: MockState) => MockState) => {
    const next = change(readMockState(userId));
    setState(next);
    if (writeMockState(userId, next)) return next;
    setStorageFailed(true);
    return null;
  };
  // Another tab's draw, start or hand-in shows up here too.
  useEffect(() => watchMockState(userId, () => setState(readMockState(userId))), [userId]);
  // Signed in, finished mocks sync with the account: other devices' show up here too.
  const signedIn = !!boot.person;
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    void syncMockHistory(userId).then((merged) => live && merged && setState(merged));
    return () => {
      live = false;
    };
  }, [userId, signedIn]);
  // Persist what reading settled: a mock whose time ran out while away is now history.
  // Once per mount (keyed by user): the first render's settled state.
  useEffect(() => {
    writeMockState(userId, state);
    // oxlint-disable-next-line react/react-compiler -- persists the state read at mount, not later edits (save() writes those).
  }, [userId]);
  // Code replays of mocks that have left every history on this browser go too.
  useEffect(() => void pruneTracks(), []);
  const [presets, setPresets] = useState<Presets | null>(null);
  const [presetsError, setPresetsError] = useState('');
  const [presetsTry, setPresetsTry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    ojRequest<Presets>('mock-oa/presets', undefined, controller.signal).then(
      (value) => setPresets(value),
      (e: Error) => !controller.signal.aborted && setPresetsError(e.message),
    );
    return () => controller.abort();
  }, [presetsTry]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [replace, setReplace] = useState<{ key: string; request: DrawRequest } | null>(null);

  async function draw(key: string, request: DrawRequest, confirmed = false) {
    setError('');
    if (!boot.person) {
      window.dispatchEvent(new Event('cswork:auth-required'));
      return;
    }
    if (!boot.person.verified && boot.person.role !== 'teacher') {
      setError(t('请先验证邮箱，验证后才能提交代码和参加模拟。', 'Verify your email first: submitting code and taking mocks need it.'));
      return;
    }
    // Read fresh: a mock whose time ran out, or one started in another tab, counts.
    const current = readMockState(userId);
    const live = !!(current.active?.startedAt || current.active?.mcq?.startedAt);
    if (live && !confirmed) {
      setReplace({ key, request });
      return;
    }
    setBusy(key);
    try {
      const drawn = await ojRequest<Drawn>('mock-oa/draw', {
        ...request,
        exclude: recentIds(current),
      });
      const now = Date.now();
      const session: MockSession = {
        id: crypto.randomUUID(),
        company: drawn.company,
        name: drawn.name,
        platform: drawn.platform,
        preset: drawn.preset,
        scoring: drawn.scoring,
        source: drawn.source,
        ...(drawn.topics?.length ? { topics: drawn.topics } : {}),
        ...(drawn.experience ? { experience: drawn.experience } : {}),
        slots: drawn.slots,
        ids: drawn.ids,
        minutes: drawn.minutes,
        skew: drawn.now - now,
        createdAt: now,
      };
      // A replaced running mock is handed in as it stands (an MCQ section first moves on to
      // coding); an unstarted draw is just dropped.
      save((latest) => {
        const running = latest.active && finishMcq(latest.active, now);
        return {
          ...(running?.startedAt ? archiveMock(latest, finishMock(running, now)) : latest),
          active: session,
        };
      });
      navigate('mock', { session: session.id });
    } catch (e) {
      const message = (e as Error).message;
      setError(t(message, englishMessage(message)));
    } finally {
      setBusy(null);
    }
  }

  // "Practise this loop" (?experience=, from a member's post) draws once per visit, through the
  // same replace prompt as any draw; never over a skill exam on the clock.
  const fromExperience = useRef(false);
  useEffect(() => {
    if (!params.experience || fromExperience.current) return;
    fromExperience.current = true;
    const exam = readMockState(userId).active;
    if (exam?.cert && exam.startedAt)
      setError(t('技能考试正在进行，交卷后再来按这场面经模拟。', 'A skill exam is in progress. Hand it in, then come back to practise this loop.'));
    else void draw('exp', { experience: params.experience });
    // oxlint-disable-next-line react/react-compiler -- one draw per visit; draw reads fresh state itself.
  }, [params.experience]);
  const report = findMock(state, params.report);
  const briefing = findMock(state, params.session);
  return (
    <div className="algorithm-library mock-oa">
      <LibrarySwitch section="mock" navigate={navigate} />
      <a
        className="mock-crosslink"
        href="/?view=mock-interview"
        onClick={(e) => {
          if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          navigate('mock-interview');
        }}
      >
        {t('还要练面试？一键抽一套模拟面试题', 'Practising interviews too? Draw a mock interview set')}
      </a>
      {storageFailed && (
        <p className="mock-note" role="alert">
          {t(
            '浏览器存储不可用，模拟无法开始，成绩也不会记录。请退出无痕模式或清理网站数据后再试。',
            "Browser storage is unavailable, so a mock can't start and results won't be kept. Leave private browsing or clear site data, then try again.",
          )}
        </p>
      )}
      {error && (
        <p className="mock-note" role="alert">
          {error}
          {boot.person && !boot.person.verified && (
            <button type="button" onClick={() => navigate('account')}>
              {t('去验证', 'Verify now')}
            </button>
          )}
        </p>
      )}
      {report?.finishedAt ? (
        <MockReport
          key={report.id}
          session={report}
          boot={boot}
          navigate={navigate}
          onResult={(result) => {
            // In place: an older report keeps its spot in the history.
            save((latest) => ({
              ...latest,
              history: latest.history.map((h) => (h.id === report.id ? { ...h, result } : h)),
            }));
            // The server scores it again on its own; a failed upload retries on the next visit.
            if (signedIn) uploadMocks([{ ...report, result }]).catch(() => {});
          }}
          again={() => draw('again', drawRequest(report))}
          busy={busy === 'again'}
        />
      ) : params.report && !report ? (
        <MissingSession navigate={navigate} />
      ) : params.session && briefing?.mcq?.startedAt && !briefing.startedAt ? (
        <MockMcqSection
          session={briefing}
          pick={(index, picks) =>
            save((latest) => {
              const a = latest.active;
              if (!a || a.id !== briefing.id || !a.mcq || a.startedAt) return latest;
              const next = a.mcq.picks.map((p, i) => (i === index ? picks : p));
              return { ...latest, active: { ...a, mcq: { ...a.mcq, picks: next } } };
            })
          }
          handIn={() => {
            const saved = save((latest) =>
              latest.active?.id === briefing.id
                ? { ...latest, active: finishMcq(latest.active, Date.now()) }
                : latest,
            );
            const coding = saved?.active;
            if (coding?.id === briefing.id && coding.startedAt)
              navigate('problem', { problem: coding.ids[0], mock: coding.id });
            else navigate('mock');
          }}
        />
      ) : params.session && briefing && !briefing.startedAt ? (
        <MockBriefing
          session={briefing}
          preset={presets?.companies.find((c) => c.slug === briefing.company)}
          boot={boot}
          navigate={navigate}
          busy={busy === 'redraw'}
          redraw={() => draw('redraw', drawRequest(briefing))}
          cancel={() => {
            save((latest) =>
              latest.active?.id === briefing.id && !latest.active.startedAt
                ? { ...latest, active: null }
                : latest,
            );
            navigate('mock');
          }}
          start={async (mcq) => {
            let started: MockSession = { ...briefing, startedAt: Date.now() };
            if (mcq) {
              let bank: McqQuestion[];
              try {
                bank = await loadMcqBank();
              } catch {
                setError(t('选择题没能加载，请重试。', 'The multiple-choice questions failed to load. Try again.'));
                return;
              }
              // Questions from the last five mocks go last.
              const seen = new Set(readMockState(userId).history.slice(0, 5).flatMap((s) => s.mcq?.ids ?? []));
              const ids = drawMcq(bank, mcq, Date.now(), seen);
              // The coding clock waits for the MCQ section to end (finishMcq).
              started = { ...briefing, mcq: { ids, picks: ids.map(() => []), minutes: mcq.minutes, startedAt: Date.now() } };
            }
            const saved = save((latest) =>
              // Started, replaced or cancelled in another tab: keep what that tab wrote.
              latest.active?.id === briefing.id && !latest.active.startedAt && !latest.active.mcq?.startedAt
                ? { ...latest, active: started }
                : latest,
            );
            // Without storage the workspace could not find the exam: do not start one.
            if (saved?.active !== started) return;
            track('mock_start', {
              company: started.preset ? started.company : 'custom',
              questions: started.ids.length,
              minutes: started.minutes,
              source: started.source,
            });
            // With MCQs this page now shows the MCQ section; otherwise coding starts.
            if (!started.mcq) navigate('problem', { problem: started.ids[0], mock: started.id });
          }}
        />
      ) : (
        <MockLanding
          state={state}
          presets={presets}
          presetsError={presetsError}
          retry={() => {
            setPresetsError('');
            setPresetsTry((n) => n + 1);
          }}
          focus={params.company}
          busy={busy}
          draw={draw}
          navigate={navigate}
          handIn={(id) => {
            // Before settling, which drops a skill exam whose time ran out.
            const cert = mockCert(userId, id);
            save((latest) =>
              latest.active?.id === id && latest.active.startedAt
                ? archiveMock(latest, finishMock(latest.active, Date.now()))
                : latest,
            );
            if (cert) handInSkill(cert.test);
            else navigate('mock', { report: id });
          }}
        />
      )}
      <AlertDialog open={!!replace} onOpenChange={(open) => !open && setReplace(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('先结束当前的模拟？', 'End the mock in progress?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                '还有一场模拟正在计时。开始新的一套会把它按当前进度交卷。',
                'Another mock is still on the clock. Starting a new one hands that one in as it stands.',
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('继续原来的', 'Keep it')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const next = replace;
                setReplace(null);
                if (next) void draw(next.key, next.request, true);
              }}
            >
              {t('交卷并开始新的', 'Hand in and start new')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MissingSession({ navigate }: { navigate: Navigate }) {
  const t = useT();
  return (
    <section className="mock-board mock-empty">
      <p className="mock-kicker">MOCK OA</p>
      <h2>{t('找不到这场模拟', "We can't find this mock")}</h2>
      <p className="mock-lede">
        {t(
          '模拟记录只保存在作答时用的浏览器里，换设备或清除网站数据后就看不到了。',
          'Mock records live only in the browser you took them in; another device or cleared site data will not have them.',
        )}
      </p>
      <div>
        <button type="button" className="mock-cta" onClick={() => navigate('mock')}>
          {t('回到模拟 OA', 'Back to Mock OA')}
          <ArrowRight size={16} />
        </button>
      </div>
    </section>
  );
}

/** The live (or drawn but unstarted) mock, with its clock ticking. */
function LiveStrip({
  session,
  navigate,
  handIn,
}: {
  session: MockSession;
  navigate: Navigate;
  handIn: (id: string) => void;
}) {
  const t = useT();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  // An MCQ section that ran out has moved on to coding (as settleMockState will record).
  const s =
    session.mcq?.startedAt && !session.startedAt && mockClock(session.mcq, now).phase === 'finished'
      ? finishMcq(session, now)
      : session;
  const inMcq = !!s.mcq?.startedAt && !s.startedAt;
  const clock = mockClock(inMcq ? s.mcq! : s, now);
  if (clock.phase === 'finished')
    return (
      <div className="mock-live">
        <span className="mock-live-tag">{t('时间到', "Time's up")}</span>
        <strong>{session.name || t('自定义模拟', 'Custom mock')}</strong>
        <span className="mock-live-actions">
          <button type="button" className="mock-cta" onClick={() => handIn(session.id)}>
            {t('查看成绩单', 'See the report')}
            <ArrowRight size={16} />
          </button>
        </span>
      </div>
    );
  const running = clock.phase === 'running';
  return (
    <div className="mock-live" data-warn={clock.warning || undefined}>
      <span className="mock-live-tag">
        <i aria-hidden="true" />
        {inMcq
          ? t('选择题环节', 'MCQ section')
          : running
            ? t('进行中', 'In progress')
            : t('已抽题，待开始', 'Drawn, not started')}
      </span>
      <strong>
        {session.name || t('自定义模拟', 'Custom mock')} · {session.ids.length}{' '}
        {t('题', session.ids.length > 1 ? 'questions' : 'question')}
      </strong>
      {running && (
        <span className="mock-live-clock">
          <span className="mock-led">{formatClock(clock.remaining)}</span>
          {t('剩余', 'left')}
        </span>
      )}
      <span className="mock-live-actions">
        <button
          type="button"
          className="mock-cta"
          onClick={() =>
            running && !inMcq
              ? navigate('problem', { problem: session.ids[0], mock: session.id })
              : navigate('mock', { session: session.id })
          }
        >
          {running ? t('继续作答', 'Resume') : t('去检录', 'Check in')}
          <ArrowRight size={16} />
        </button>
        {running && !inMcq && (
          <button type="button" className="mock-ghost" onClick={() => handIn(session.id)}>
            <Flag size={14} />
            {t('交卷', 'Hand in')}
          </button>
        )}
      </span>
    </div>
  );
}

function MockLanding({
  state,
  presets,
  presetsError,
  retry,
  focus,
  busy,
  draw,
  navigate,
  handIn,
}: {
  state: MockState;
  presets: Presets | null;
  presetsError: string;
  retry: () => void;
  focus?: string;
  busy: string | null;
  draw: (key: string, request: DrawRequest) => void;
  navigate: Navigate;
  handIn: (id: string) => void;
}) {
  const t = useT(),
    zh = useLocale() === 'zh';
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (presets?.companies ?? [])
      .filter(
        (c) =>
          (!q || `${c.name} ${c.slug}`.toLowerCase().includes(q)) &&
          (!platform || platformKey(c.platform) === platform),
      )
      // Ready presets first; the researched order is kept within each group.
      .sort((a, b) => +(b.pool.total >= b.questions) - +(a.pool.total >= a.questions));
  }, [presets, query, platform]);
  const focused = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!presets || !focus) return;
    document.getElementById(`mock-${focus}`)?.scrollIntoView({ block: 'center' });
    focused.current?.focus({ preventScroll: true });
  }, [presets, focus]);
  const total = presets ? presets.all.oa + presets.all.lc : null;
  return (
    <>
      <section className="mock-board" aria-labelledby="mock-title">
        <p className="mock-kicker">
          <i aria-hidden="true" />
          MOCK OA · {t('限时模拟', 'Timed simulation')}
        </p>
        <h2 id="mock-title">
          {t('一键抽一套真实格式的 OA，计时开考。', 'One click draws a real-format OA. The clock starts when you do.')}
        </h2>
        <p className="mock-lede">
          {t(
            '题量、时长和平台按各公司近期的真实 OA 设定，题目从这家公司的 OA 真题和高频 LeetCode 题里抽。时间到自动交卷，随后给出成绩单并解锁题解。',
            "Question count, time and platform follow each company's recent real OA; problems come from its OA bank and its frequent LeetCode problems. At zero the exam hands itself in, then you get a score report and the solutions.",
          )}
        </p>
        <dl className="mock-board-stats">
          <div>
            <dt>{t('家公司', 'companies')}</dt>
            <dd>{presets ? presets.companies.length : '—'}</dd>
          </div>
          <div>
            <dt>{t('道可判题', 'judgeable problems')}</dt>
            <dd>{total ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('场已完成', 'mocks taken')}</dt>
            <dd>{state.history.length}</dd>
          </div>
        </dl>
        {state.active && <LiveStrip session={state.active} navigate={navigate} handIn={handIn} />}
      </section>

      <section className="mock-section" aria-labelledby="mock-board-title">
        <div className="mock-toolbar">
          <h3 id="mock-board-title">{t('按公司开考', 'Pick a company')}</h3>
          <label className="mock-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('搜索公司', 'Search companies')}
              aria-label={t('搜索公司', 'Search companies')}
            />
          </label>
          <div className="mock-chips" role="group" aria-label={t('平台', 'Platform')}>
            {[
              ['', t('全部', 'All')],
              ['hackerrank', 'HackerRank'],
              ['codesignal', 'CodeSignal'],
            ].map(([key, label]) => (
              <button key={key} type="button" aria-pressed={platform === key} onClick={() => setPlatform(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {presetsError ? (
          <p className="mock-note" role="alert">
            {t(presetsError, englishMessage(presetsError))}
            <button type="button" onClick={retry}>
              {t('重试', 'Retry')}
            </button>
          </p>
        ) : !presets ? (
          <ul className="mock-grid" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="mock-card mock-card-skeleton" />
            ))}
          </ul>
        ) : (
          <ul className="mock-grid">
            {shown.map((c) => {
              const ready = c.pool.total >= c.questions;
              const extra = extraSections(c, zh);
              return (
                <li
                  key={c.slug}
                  id={`mock-${c.slug}`}
                  className="mock-card"
                  data-ready={ready}
                  data-highlight={focus === c.slug || undefined}
                >
                  <div className="mock-card-main">
                    <header>
                      <Logo slug={c.slug} name={c.name} />
                      <h4>{c.name}</h4>
                      <span className="mock-platform" data-platform={platformKey(c.platform)}>
                        {c.platform}
                      </span>
                    </header>
                    <p className="mock-format">
                      {t(`${c.questions} 题 · ${c.minutes} 分钟`, `${c.questions} questions · ${c.minutes} min`)}
                      <span>
                        {c.scoring === 'gca'
                          ? t(' · GCA 式计分', ' · GCA-style score')
                          : t(' · 按用例计分', ' · scored by tests')}
                      </span>
                    </p>
                    <Stops slots={c.slots} zh={zh} />
                    <p className="mock-focus" title={zh ? c.focus_zh : c.focus_en}>
                      {zh ? c.focus_zh : c.focus_en}
                    </p>
                    <ul className="mock-topic-chips" aria-label={t('主要考点', 'Main topics')}>
                      {c.topics.slice(0, 3).map((topic) => (
                        <li key={topic.slug}>{topicName(topic.slug, zh)}</li>
                      ))}
                    </ul>
                    {extra.text && (
                      <p className="mock-extra" title={extra.text}>
                        <b>
                          {extra.codingOnly
                            ? t('只有编程：', 'Coding only: ')
                            : c.mcq
                              ? t('编程之外（选择题有模拟）：', 'Besides coding (MCQs simulated): ')
                              : t('编程之外（不模拟）：', 'Besides coding (not simulated): ')}
                        </b>
                        {extra.text}
                      </p>
                    )}
                    <footer>
                      <span className="mock-pool">
                        {t('题池', 'Pool')} <b>{c.pool.total}</b>
                      </span>
                      <a href={`/mock-oa/${c.slug}`} className="mock-link">
                        {t('格式详情', 'Format')}
                      </a>
                      <button
                        type="button"
                        className="mock-cta"
                        ref={focus === c.slug ? focused : undefined}
                        disabled={!ready || !!busy}
                        aria-label={t(`开始 ${c.name} 模拟`, `Start the ${c.name} mock`)}
                        onClick={() => draw(c.slug, { company: c.slug })}
                      >
                        {busy === c.slug ? <LoaderCircle size={15} className="cs-spin" /> : null}
                        {ready ? t('开始模拟', 'Start mock') : t('题量不足', 'Not enough yet')}
                        {ready && busy !== c.slug ? <ArrowRight size={15} /> : null}
                      </button>
                    </footer>
                  </div>
                  <div className="mock-card-stub" aria-hidden="true">
                    <b>{c.minutes}</b>
                    <span>MIN</span>
                    <small>×{c.questions}</small>
                  </div>
                </li>
              );
            })}
            {!shown.length && (
              <li className="mock-none">{t('没有匹配的公司。', 'No companies match.')}</li>
            )}
          </ul>
        )}
      </section>

      {presets && <CustomMock presets={presets} busy={busy === 'custom'} draw={draw} />}
      <MockHistory history={state.history} navigate={navigate} />
    </>
  );
}

function CustomMock({
  presets,
  busy,
  draw,
}: {
  presets: Presets;
  busy: boolean;
  draw: (key: string, request: DrawRequest) => void;
}) {
  const t = useT();
  const [company, setCompany] = useState('');
  const [questions, setQuestions] = useState(2);
  const [minutes, setMinutes] = useState(90);
  const [level, setLevel] = useState<'ladder' | Slot>('ladder');
  const [source, setSource] = useState<MockSource>('mixed');
  const [topics, setTopics] = useState<string[]>([]);
  const counts =
    [...presets.companies, ...presets.others].find((c) => c.slug === company)?.pool ?? presets.all;
  const pool = source === 'mixed' ? counts.oa + counts.lc : counts[source];
  const radio = <T extends string | number>(
    name: string,
    value: T,
    current: T,
    set: (v: T) => void,
    label: string,
  ) => (
    <label key={String(value)}>
      <input
        type="radio"
        name={name}
        className="sr-only"
        checked={current === value}
        onChange={() => set(value)}
      />
      <span>{label}</span>
    </label>
  );
  return (
    <section className="mock-section mock-custom" aria-labelledby="mock-custom-title">
      <div className="mock-toolbar">
        <h3 id="mock-custom-title">{t('自定义一套', 'Build your own')}</h3>
        <p>{t('公司可不选：从全站可判题里抽。', 'Company is optional: leave it empty to draw from every judgeable problem.')}</p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          draw('custom', {
            custom: {
              ...(company ? { company } : {}),
              questions,
              minutes,
              slots: level === 'ladder' ? LADDER[questions] : Array(questions).fill(level),
              source,
              ...(topics.length ? { topics } : {}),
            },
          });
        }}
      >
        <label className="mock-field">
          <span>{t('公司', 'Company')}</span>
          <select value={company} onChange={(e) => setCompany(e.target.value)}>
            <option value="">{t('任意（全站题库）', 'Any (whole catalogue)')}</option>
            <optgroup label={t('真实格式', 'Real formats')}>
              {presets.companies.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </optgroup>
            {presets.others.length > 0 && (
              <optgroup label={t('更多公司', 'More companies')}>
                {presets.others.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <fieldset className="mock-field mock-seg">
          <legend>{t('题量', 'Questions')}</legend>
          <div>{[1, 2, 3, 4].map((n) => radio<number>('mock-questions', n, questions, setQuestions, String(n)))}</div>
        </fieldset>
        <label className="mock-field">
          <span>{t('时长', 'Time')}</span>
          <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            {MINUTES.map((m) => (
              <option key={m} value={m}>
                {t(`${m} 分钟`, `${m} min`)}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="mock-field mock-seg">
          <legend>{t('难度', 'Difficulty')}</legend>
          <div>
            {radio<'ladder' | Slot>('mock-level', 'ladder', level, setLevel, t('递进', 'Ladder'))}
            {(['easy', 'medium', 'hard'] as Slot[]).map((s) =>
              radio<'ladder' | Slot>('mock-level', s, level, setLevel, t(LEVEL_NAME[s][0], LEVEL_NAME[s][1])),
            )}
          </div>
        </fieldset>
        <fieldset className="mock-field mock-seg">
          <legend>{t('题源', 'Source')}</legend>
          <div>
            {radio<MockSource>('mock-source', 'mixed', source, setSource, t('混合', 'Mixed'))}
            {radio<MockSource>('mock-source', 'oa', source, setSource, t('OA 真题', 'OA only'))}
            {radio<MockSource>('mock-source', 'lc', source, setSource, 'LeetCode')}
          </div>
        </fieldset>
        <fieldset className="mock-field mock-topics">
          <legend>
            {t('知识点（可选，最多 5 个）', 'Topics (optional, up to 5)')} <b>{topics.length}/5</b>
          </legend>
          <div className="mock-chips">
            {Object.entries(STOP_NAMES).map(([slug, [zh, en]]) => {
              const on = topics.includes(slug);
              return (
                <button
                  key={slug}
                  type="button"
                  aria-pressed={on}
                  disabled={!on && topics.length >= 5}
                  onClick={() => setTopics(on ? topics.filter((x) => x !== slug) : [...topics, slug])}
                >
                  {t(zh, en)}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="mock-custom-go">
          <span className="mock-pool">
            {topics.length ? t('题池（未按知识点筛）', 'Pool (before topics)') : t('题池', 'Pool')} <b>{pool}</b>
          </span>
          <button type="submit" className="mock-cta" disabled={busy || pool < questions}>
            {busy ? <LoaderCircle size={15} className="cs-spin" /> : <Shuffle size={15} />}
            {t('抽题', 'Draw')}
          </button>
        </div>
      </form>
    </section>
  );
}

function MockHistory({ history, navigate }: { history: MockSession[]; navigate: Navigate }) {
  const t = useT(),
    zh = useLocale() === 'zh';
  return (
    <section className="mock-section" aria-labelledby="mock-history-title">
      <div className="mock-toolbar">
        <h3 id="mock-history-title">{t('最近的模拟', 'Recent mocks')}</h3>
        <p>{t('最近 30 场，已同步到你的账号，换台设备也能看到。', 'The last 30, synced to your account across devices.')}</p>
      </div>
      {history.length ? (
        <ol className="mock-history">
          {history.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => navigate('mock', { report: s.id })}>
                <Logo slug={s.company} name={s.name || 'Custom'} />
                <span className="mock-history-name">
                  <strong>{s.name || t('自定义模拟', 'Custom mock')}</strong>
                  <small>
                    {new Date(s.startedAt ?? s.createdAt).toLocaleString(zh ? 'zh-CN' : 'en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' · '}
                    {t(`${s.ids.length} 题 · ${s.minutes} 分钟`, `${s.ids.length} Q · ${s.minutes} min`)}
                  </small>
                </span>
                <span className="mock-history-score">
                  {s.result ? (
                    <>
                      <span>
                        <b>{s.result.score}</b>/{s.result.max}
                      </span>
                      <small>
                        {t(`通过 ${s.result.solved}/${s.ids.length}`, `${s.result.solved}/${s.ids.length} solved`)}
                      </small>
                    </>
                  ) : (
                    <small>{t('查看成绩', 'See score')}</small>
                  )}
                </span>
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mock-none">
          {t('交卷后成绩会记在这里。先挑一家公司试试？', 'Finished mocks show up here. Pick a company above to take your first.')}
        </p>
      )}
    </section>
  );
}

/** What a company's OA tests: focus, the weighted topics (linked to their Line 500 stops), style and tips. */
export function MockTopicBrief({ preset, navigate }: { preset: Preset; navigate: Navigate }) {
  const t = useT(),
    zh = useLocale() === 'zh';
  const linked = preset.topics.some((topic) => stopHref(topic.slug));
  return (
    <section className="mock-brief" aria-labelledby="mock-brief-title">
      <h3 id="mock-brief-title">{t('这家 OA 考什么', 'What this OA tests')}</h3>
      <div className="mock-brief-main">
        <p className="mock-brief-focus">{zh ? preset.focus_zh : preset.focus_en}</p>
        <ol className="mock-weights" aria-label={t('考点，按权重排序', 'Topics, heaviest first')}>
          {preset.topics.map(({ slug, weight }) => {
            const href = stopHref(slug),
              name = topicName(slug, zh);
            return (
              <li key={slug} style={{ '--w': weight } as React.CSSProperties}>
                {href ? (
                  <a
                    href={href}
                    onClick={(e) => {
                      if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                      e.preventDefault();
                      navigate('problems', { section: slug });
                    }}
                  >
                    {name}
                  </a>
                ) : (
                  <span>{name}</span>
                )}
                <i aria-hidden="true" />
                <span className="sr-only">
                  {t(`权重 ${Math.round(weight * 100)}%`, `weight ${Math.round(weight * 100)}%`)}
                </span>
              </li>
            );
          })}
        </ol>
        {linked && (
          <p className="mock-brief-hint">
            {t('点专题名，去 500 路对应的站点专项练习。', 'Pick a topic to practise its stop on Line 500.')}
          </p>
        )}
      </div>
      <dl className="mock-brief-notes">
        <div>
          <dt>{t('题面风格', 'Style')}</dt>
          <dd>{zh ? preset.style_zh : preset.style_en}</dd>
        </div>
        <div>
          <dt>{t('备考建议', 'Tips')}</dt>
          <dd>{zh ? preset.tips_zh : preset.tips_en}</dd>
        </div>
      </dl>
      {preset.evidence === 'thin' && (
        <p className="mock-brief-caveat">
          <Info size={14} aria-hidden="true" />
          {t(
            '这家公司公开的 OA 信息很少，以上内容只作参考。',
            'There is little public information about this OA, so treat this as a rough guide.',
          )}
        </p>
      )}
    </section>
  );
}

/** The MCQ section: its own clock; handing in (or time running out) starts the coding part. */
function MockMcqSection({
  session,
  pick,
  handIn,
}: {
  session: MockSession;
  pick: (index: number, picks: number[]) => void;
  handIn: () => void;
}) {
  const t = useT(),
    zh = useLocale() === 'zh';
  const mcq = session.mcq!;
  const [bank, setBank] = useState<McqQuestion[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    loadMcqBank().then(
      (value) => live && setBank(value),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [attempt]);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const clock = mockClock(mcq, now);
  const over = clock.phase === 'finished';
  const handedIn = useRef(false);
  useEffect(() => {
    if (!over || handedIn.current) return;
    handedIn.current = true;
    handIn();
  }, [over, handIn]);
  // Start swaps the briefing (and its focused button) for this section: take the focus over.
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => title.current?.focus(), []);
  const byId = new Map((bank ?? []).map((q) => [q.id, q]));
  const answered = mcq.picks.filter((p) => p.length).length;
  return (
    <>
      <section className="mock-board" aria-labelledby="mock-mcq-title">
        <p className="mock-kicker">
          <i aria-hidden="true" />
          {t('选择题环节', 'MCQ section')} · MOCK OA
        </p>
        <div className="mock-pass">
          <div>
            <h2 id="mock-mcq-title" ref={title} tabIndex={-1}>
              <Logo slug={session.company} name={session.name || 'Custom'} />
              {session.name || t('自定义模拟', 'Custom mock')}
            </h2>
            <p className="mock-lede">
              {t(
                `${mcq.ids.length} 道选择题，交卷后进入 ${session.ids.length} 道编程题`,
                `${mcq.ids.length} multiple-choice questions, then ${session.ids.length} coding questions`,
              )}
            </p>
          </div>
          <div className="mock-pass-clock" role="timer" aria-label={t('选择题剩余时间', 'MCQ time left')}>
            <span className="mock-led">{formatClock(clock.remaining)}</span>
            <small>{t('剩余', 'LEFT')}</small>
          </div>
        </div>
      </section>
      <section className="mock-section" aria-label={t('选择题', 'Multiple-choice questions')}>
        {failed ? (
          <p className="mock-note" role="alert">
            {t('选择题没能加载。', 'The questions failed to load.')}
            <button
              type="button"
              onClick={() => {
                setFailed(false);
                setAttempt((n) => n + 1);
              }}
            >
              {t('重试', 'Retry')}
            </button>
          </p>
        ) : !bank ? (
          <p aria-busy="true">
            <LoaderCircle className="cs-spin" aria-hidden="true" /> {t('正在加载选择题…', 'Loading questions…')}
          </p>
        ) : (
          <ol className="oa-mcq-list">
            {mcq.ids.map((id, i) => {
              const q = byId.get(id);
              return q ? (
                <li key={id}>
                  <McqItem
                    q={q}
                    text={zh ? q.zh : q.en}
                    n={i + 1}
                    zh={zh}
                    picks={mcq.picks[i] ?? []}
                    onPick={(picks) => pick(i, picks)}
                    reveal={false}
                  />
                </li>
              ) : null;
            })}
          </ol>
        )}
        <div className="mock-actions">
          <button type="button" className="mock-cta" onClick={handIn}>
            <Flag size={15} />
            {t(
              `交卷，进入编程（已答 ${answered}/${mcq.ids.length}）`,
              `Hand in and start coding (${answered}/${mcq.ids.length} answered)`,
            )}
          </button>
        </div>
      </section>
    </>
  );
}

function MockBriefing({
  session,
  preset,
  boot,
  navigate,
  busy,
  redraw,
  cancel,
  start,
}: {
  session: MockSession;
  preset?: Preset;
  boot: Boot;
  navigate: Navigate;
  busy: boolean;
  redraw: () => void;
  cancel: () => void;
  /** Starts the clock; with an MCQ config, the MCQ section comes first. */
  start: (mcq?: McqConfig) => void;
}) {
  const t = useT(),
    zh = useLocale() === 'zh';
  const [withMcq, setWithMcq] = useState(true);
  // Only a company's real format has its MCQ section; a custom mock is coding only.
  const offer = session.preset ? preset?.mcq : undefined;
  const mcq = withMcq ? offer : undefined;
  const known = new Set(boot.problems.map((p) => p.id));
  const missing = session.ids.some((id) => !known.has(id));
  const extra = preset && !extraSections(preset, zh).codingOnly ? extraSections(preset, zh).text : '';
  return (
    <section className="mock-board mock-briefing" aria-labelledby="mock-briefing-title">
      <p className="mock-kicker">
        <i aria-hidden="true" />
        {t('检录', 'Check-in')} · MOCK OA
      </p>
      <div className="mock-pass">
        <div>
          <h2 id="mock-briefing-title">
            <Logo slug={session.company} name={session.name || 'Custom'} />
            {session.name || t('自定义模拟', 'Custom mock')}
          </h2>
          <p className="mock-lede">
            {[session.platform, t(`${session.ids.length} 道编程题`, `${session.ids.length} coding questions`)]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <Stops slots={session.slots} zh={zh} />
        </div>
        <div className="mock-pass-clock" aria-label={t(`限时 ${session.minutes} 分钟`, `${session.minutes} minutes`)}>
          <span className="mock-led">{formatClock(session.minutes * 60000)}</span>
          <small>{t('限时', 'TIME LIMIT')}</small>
        </div>
      </div>
      {preset && <MockTopicBrief preset={preset} navigate={navigate} />}
      {offer && (
        <label className="mock-mcq-toggle">
          <input type="checkbox" checked={withMcq} onChange={(e) => setWithMcq(e.target.checked)} />
          <span>
            {t(
              `含选择题 ${offer.count} 题 / ${offer.minutes} 分钟`,
              `Include the MCQ section: ${offer.count} questions / ${offer.minutes} min`,
            )}
            <small>
              {t(
                '先做选择题，单独计时；交卷或时间到后进入编程题。',
                'Taken first on its own clock; coding starts when you hand it in or time runs out.',
              )}
            </small>
          </span>
        </label>
      )}
      <ul className="mock-rules">
        <li>
          <Timer size={16} aria-hidden="true" />
          {mcq
            ? t(
                `点「开始计时」后先做 ${mcq.count} 道选择题（${mcq.minutes} 分钟），交卷或时间到后开始 ${session.minutes} 分钟的编程倒计时；刷新或离开页面不会暂停。`,
                `Press Start for ${mcq.count} multiple-choice questions (${mcq.minutes} min); handing them in or running out of time starts the ${session.minutes}-minute coding countdown. Refreshing or leaving does not pause either.`,
              )
            : t(
                `点「开始计时」后倒计时 ${session.minutes} 分钟；刷新或离开页面不会暂停。`,
                `The ${session.minutes}-minute countdown starts when you press Start; refreshing or leaving the page does not pause it.`,
              )}
        </li>
        <li>
          <Shuffle size={16} aria-hidden="true" />
          {t('题目在开考后揭晓，可以随时在各题之间切换，顺序不限。', 'Questions are revealed when the clock starts; switch between them freely, in any order.')}
        </li>
        <li>
          <EyeOff size={16} aria-hidden="true" />
          {t('考试期间不显示题解、提示和其他题目的入口。', 'Solutions, hints and other problems are hidden until you finish.')}
        </li>
        <li>
          <Flag size={16} aria-hidden="true" />
          {t(
            '时间到自动交卷，也可以提前交卷。成绩按考试时段内的提交计算：通过的测试用例占比。',
            "At zero the exam hands itself in; you can also finish early. The score uses this exam's submissions: the share of tests passed.",
          )}
        </li>
        <li>
          <Info size={16} aria-hidden="true" />
          {mcq && extra
            ? t(
                `模拟编程和选择题部分（选择题是本站原创题，按真实 OA 的考点出）。真实 OA 编程之外还有：${extra}；其中只模拟了选择题，不含摄像头监考。`,
                `The coding and MCQ parts are simulated (the MCQs are original, on the topics the real OA covers). Besides coding, the real OA has: ${extra}; only its MCQs are simulated here, and there is no camera proctoring.`,
              )
            : mcq
              ? t(
                  `模拟编程和选择题部分（选择题是本站原创题，按真实 OA 的考点出），不含摄像头监考。`,
                  'The coding and MCQ parts are simulated (the MCQs are original, on the topics the real OA covers); there is no camera proctoring.',
                )
              : extra
                ? t(`只模拟编程部分；${extra}不在本模拟内。`, `Only the coding part is simulated; not included: ${extra}.`)
                : t('只模拟编程部分，不含摄像头监考。', 'Only the coding part is simulated; there is no camera proctoring.')}
        </li>
      </ul>
      {missing && (
        <p className="mock-note" role="alert">
          {t('有题目暂时打不开了，请换一套。', 'Some of these problems are unavailable right now. Draw another set.')}
        </p>
      )}
      <div className="mock-actions">
        <button type="button" className="mock-cta mock-cta-big" onClick={() => start(mcq)} disabled={missing} autoFocus>
          <Timer size={18} />
          {t('开始计时', 'Start the clock')}
        </button>
        <button type="button" className="mock-ghost" onClick={redraw} disabled={busy}>
          {busy ? <LoaderCircle size={14} className="cs-spin" /> : <RotateCcw size={14} />}
          {t('换一套', 'Redraw')}
        </button>
        <button type="button" className="mock-ghost" onClick={cancel}>
          {t('取消', 'Cancel')}
        </button>
      </div>
    </section>
  );
}

function resultLabel(
  item: Report['items'][number],
  t: (zh: string, en: string) => string,
): [string, string] {
  if (item.best?.accepted) return ['ac', 'AC'];
  if (item.pending && !item.best) return ['pending', t('判题中', 'Judging')];
  if (item.best && item.best.passed > 0)
    return ['partial', t(`部分 ${item.best.passed}/${item.best.total}`, `Partial ${item.best.passed}/${item.best.total}`)];
  if (item.best?.status) return ['tried', t(...verdict(item.best.status))];
  return ['todo', t('未作答', 'Not attempted')];
}

function MockReport({
  session,
  boot,
  navigate,
  onResult,
  again,
  busy,
}: {
  session: MockSession;
  boot: Boot;
  navigate: Navigate;
  onResult: (result: NonNullable<MockSession['result']>) => void;
  again: () => void;
  busy: boolean;
}) {
  const t = useT(),
    locale = useLocale();
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const recorded = useRef(!!session.result);
  useEffect(() => {
    const controller = new AbortController();
    const { from, to } = reportWindow(session);
    const query = new URLSearchParams({
      ids: session.ids.join(','),
      from: String(from),
      to: String(to),
      scoring: session.scoring,
      slots: session.slots.join(','),
      // The scenario, for how this score stands among other learners' (mockPeers).
      preset: session.preset ? '1' : '0',
      ...(session.company ? { company: session.company } : {}),
      source: session.source,
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    ojRequest<Report>(`mock-oa/report?${query}`, undefined, controller.signal).then(
      (value) => {
        setData(value);
        // Verdicts still arriving: look again shortly (bounded).
        if (value.pending && attempt < 40) timer = setTimeout(() => setAttempt((n) => n + 1), 3000);
      },
      (e: Error) => !controller.signal.aborted && setError(e.message),
    );
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
    // The session is fixed for this report (keyed by id); only retries refetch.
    // oxlint-disable-next-line react/react-compiler -- see above.
  }, [attempt]);
  const solved = data?.items.filter((i) => i.best?.accepted).length ?? 0;
  useEffect(() => {
    if (!data || data.pending || recorded.current) return;
    recorded.current = true;
    const result = {
      score: data.score.value,
      max: data.score.max,
      solved,
      estimate: data.score.estimate,
    };
    onResult(result);
    track('mock_finish', {
      company: session.preset ? session.company : 'custom',
      questions: session.ids.length,
      score: result.score,
      max: result.max,
      solved,
      reason: session.reason ?? 'manual',
    });
  }, [data, solved, onResult, session]);
  const used = Math.max(0, (session.finishedAt ?? session.startedAt ?? 0) - (session.startedAt ?? 0));
  const titles = new Map(boot.problems.map((p) => [p.id, p]));
  // The MCQ section is scored here, in this browser: it stays out of the account history.
  const [bank, setBank] = useState<McqQuestion[] | null>(null);
  useEffect(() => {
    if (session.mcq) loadMcqBank().then(setBank, () => {});
  }, [session.mcq]);
  const mcq = session.mcq && bank ? scoreMcq(bank, session.mcq) : null;
  const byId = new Map((bank ?? []).map((q) => [q.id, q]));
  return (
    <>
      <section className="mock-board mock-report" aria-labelledby="mock-report-title">
        <p className="mock-kicker">
          <i aria-hidden="true" />
          {t('成绩单', 'Score report')} · MOCK OA
        </p>
        <h2 id="mock-report-title">
          <Logo slug={session.company} name={session.name || 'Custom'} />
          {session.name || t('自定义模拟', 'Custom mock')}
          {session.platform ? <small>{session.platform}</small> : null}
        </h2>
        <div className="mock-score" aria-live="polite">
          {data ? (
            <>
              <span className="mock-led mock-score-value">{data.score.value}</span>
              <span className="mock-score-max">/ {data.score.max}</span>
              {data.peers && (
                <small className="mock-peers">
                  {t(
                    `超过 ${Math.round((100 * data.peers.below) / data.peers.n)}% 的同场景模拟（${data.peers.n} 人）`,
                    `Ahead of ${Math.round((100 * data.peers.below) / data.peers.n)}% of mocks like this (${data.peers.n} people)`,
                  )}
                </small>
              )}
              {data.score.estimate && (
                <small>
                  {t(
                    'CodeSignal GCA 风格估算（200–600），难题权重更高，仅供参考',
                    'CodeSignal GCA-style estimate (200–600); harder questions weigh more. Indicative only',
                  )}
                </small>
              )}
            </>
          ) : error ? (
            <span role="alert">
              {t(error, englishMessage(error))}{' '}
              <button type="button" className="mock-ghost" onClick={() => { setError(''); setAttempt((n) => n + 1); }}>
                {t('重试', 'Retry')}
              </button>
            </span>
          ) : (
            <span className="mock-led mock-score-value" aria-busy="true">
              <LoaderCircle className="cs-spin" />
            </span>
          )}
        </div>
        <dl className="mock-board-stats">
          <div>
            <dt>{t('用时', 'time used')}</dt>
            <dd>{formatClock(used)}</dd>
          </div>
          <div>
            <dt>{t('通过', 'solved')}</dt>
            <dd>
              {solved}/{session.ids.length}
            </dd>
          </div>
          <div>
            <dt>{t('次提交', 'submissions')}</dt>
            <dd>{data ? data.items.reduce((n, i) => n + i.attempts, 0) : '—'}</dd>
          </div>
          {mcq && data && (
            <div>
              <dt>{t('合计（编程 + 选择题）', 'total (coding + MCQ)')}</dt>
              <dd>
                {data.score.per.reduce((a, b) => a + b, 0) + mcq.points}/{data.score.per.length * 100 + mcq.max}
              </dd>
            </div>
          )}
          <div>
            <dt>{t('交卷', 'handed in')}</dt>
            <dd className="mock-dd-text">
              {session.reason === 'timeout' ? t('时间到', 'at time-up') : t('手动', 'by you')}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mock-section" aria-labelledby="mock-results-title">
        <div className="mock-toolbar">
          <h3 id="mock-results-title">{t('逐题结果', 'Question by question')}</h3>
          <p>{t('交卷后题解已解锁，点开题目即可复盘。', 'Solutions are unlocked now; open a question to review it.')}</p>
        </div>
        <ol className="mock-results">
          {session.ids.map((id, index) => {
            const item = data?.items.find((i) => i.id === id);
            const summary = titles.get(id);
            const [state, label] = item ? resultLabel(item, t) : ['todo', '—'];
            const { level, estimated } = reportLevel(id, summary?.difficulty, item?.estimate, session.slots[index]);
            return (
              <li key={id} data-state={state}>
                <span className="mock-q">Q{index + 1}</span>
                <span className="mock-result-title">
                  <strong>{summary ? problemTitle(summary, locale) : id}</strong>
                  <small>
                    <span title={estimated ? t('AI 估计的难度', 'AI-estimated difficulty') : undefined}>
                      {estimated && <span aria-hidden="true">≈</span>}
                      {estimated && <span className="sr-only">{t('估计', 'Estimated ')}</span>}
                      {t(...LEVEL_NAME[level])}
                    </span>
                    {item
                      ? t(` · 提交 ${item.attempts} 次`, ` · ${item.attempts} submission${item.attempts === 1 ? '' : 's'}`)
                      : ''}
                    {item?.firstAcceptedMs != null
                      ? t(` · ${formatClock(item.firstAcceptedMs)} 时通过`, ` · AC at ${formatClock(item.firstAcceptedMs)}`)
                      : ''}
                  </small>
                </span>
                <span className="mock-chip" data-state={state}>
                  {label}
                </span>
                <span className="mock-points">
                  {data ? `${data.score.per[index] ?? 0}` : '—'}
                  <small>/100</small>
                </span>
                <button type="button" className="mock-ghost" onClick={() => navigate('problem', { problem: id })}>
                  {t('复盘', 'Review')}
                  <ArrowRight size={14} />
                </button>
              </li>
            );
          })}
          {mcq && (
            <li data-state={mcq.correct === mcq.total ? 'ac' : mcq.correct ? 'partial' : 'tried'}>
              <span className="mock-q">MCQ</span>
              <span className="mock-result-title">
                <strong>{t('选择题环节', 'MCQ section')}</strong>
                <small>
                  {t(`答对 ${mcq.correct}/${mcq.total}`, `${mcq.correct} of ${mcq.total} correct`)}
                </small>
              </span>
              <span className="mock-chip" data-state={mcq.correct === mcq.total ? 'ac' : mcq.correct ? 'partial' : 'tried'}>
                {mcq.correct}/{mcq.total}
              </span>
              <span className="mock-points">
                {mcq.points}
                <small>/100</small>
              </span>
              <button
                type="button"
                className="mock-ghost"
                onClick={() => {
                  const review = document.getElementById('mock-mcq-review') as HTMLDetailsElement | null;
                  if (!review) return;
                  review.open = true;
                  review.scrollIntoView({ block: 'start' });
                }}
              >
                {t('解析', 'Review')}
                <ArrowRight size={14} />
              </button>
            </li>
          )}
        </ol>
        {mcq && session.mcq && (
          <details className="mock-mcq-review" id="mock-mcq-review">
            <summary>{t('选择题答案与解析', 'MCQ answers and explanations')}</summary>
            <ol className="oa-mcq-list">
              {session.mcq.ids.map((id, i) => {
                const q = byId.get(id);
                return q ? (
                  <li key={id}>
                    <McqItem
                      q={q}
                      text={locale === 'zh' ? q.zh : q.en}
                      n={i + 1}
                      zh={locale === 'zh'}
                      picks={session.mcq?.picks[i] ?? []}
                      onPick={() => {}}
                      reveal
                    />
                  </li>
                ) : null;
              })}
            </ol>
          </details>
        )}
        <p className="mock-footnote">
          {t(
            '部分分：判题遇到第一个未通过的用例就停止，所以按它之前通过的用例数计。成绩只统计开考到交卷之间的提交，并同步到你的账号。',
            'Partial credit: the judge stops at the first failing test, so it counts the tests passed before that one. Only submissions between the start and the hand-in count, and the result is saved to your account.',
          )}
        </p>
        <div className="mock-actions">
          <button type="button" className="mock-cta" onClick={again} disabled={busy}>
            {busy ? <LoaderCircle size={15} className="cs-spin" /> : <RotateCcw size={15} />}
            {t('再来一套', 'New draw')}
          </button>
          <button type="button" className="mock-ghost mock-ghost-light" onClick={() => navigate('mock')}>
            {t('全部模拟', 'All mocks')}
          </button>
          <button type="button" className="mock-ghost mock-ghost-light" onClick={() => navigate('problems')}>
            {t('回到题库', 'Back to problems')}
          </button>
        </div>
      </section>
      <MockReplay
        session={session}
        title={(id) => {
          const summary = titles.get(id);
          return summary ? problemTitle(summary, locale) : id;
        }}
      />
    </>
  );
}
