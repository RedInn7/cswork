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
import type { Boot } from '@/lib/types';
import {
  archiveMock,
  findMock,
  finishMock,
  formatClock,
  LADDER,
  mockClock,
  readMockState,
  reportWindow,
  writeMockState,
  type MockSession,
  type MockSource,
  type MockState,
  type QuestionResult,
  type Scoring,
  type Slot,
} from '@/lib/mock-oa';
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
  pool: { oa: number; lc: number; total: number };
};
type Presets = {
  companies: Preset[];
  others: { slug: string; name: string; pool: number }[];
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
  now: number;
};
type DrawRequest =
  | { company: string }
  | {
      custom: {
        company?: string;
        questions: number;
        minutes: number;
        slots: Slot[];
        source: MockSource;
      };
    };
type Report = {
  items: {
    id: string;
    attempts: number;
    best: QuestionResult | null;
    firstAcceptedMs: number | null;
    pending: boolean;
  }[];
  score: { value: number; min: number; max: number; per: number[]; estimate: boolean };
  pending: boolean;
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
/** "None" (or 无) means coding is the whole OA; anything longer says what else there is. */
const extraSections = (p: Preset, zh: boolean) =>
  zh ? (p.sections_zh === '无' ? '' : p.sections_zh) : p.sections_en === 'None' ? '' : p.sections_en;
const platformKey = (platform: string | null) =>
  (platform || '').split(/[\s/]/)[0].toLowerCase();
/** Ids from the running mock and the last five, so a new draw brings fresh problems. */
const recentIds = (state: MockState) =>
  [state.active, ...state.history.slice(0, 5)].flatMap((s) => s?.ids ?? []);
const drawRequest = (s: MockSession): DrawRequest =>
  s.preset && s.company
    ? { company: s.company }
    : {
        custom: {
          ...(s.company ? { company: s.company } : {}),
          questions: s.ids.length,
          minutes: s.minutes,
          slots: s.slots,
          source: s.source,
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
 * score report (&report=). Sessions and history stay in this browser.
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
  const save = (next: MockState) => {
    setState(next);
    if (!writeMockState(userId, next)) setStorageFailed(true);
  };
  // Persist what reading settled: a mock whose time ran out while away is now history.
  // Once per mount (keyed by user): the first render's settled state.
  useEffect(() => {
    writeMockState(userId, state);
    // oxlint-disable-next-line react/react-compiler -- persists the state read at mount, not later edits (save() writes those).
  }, [userId]);
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
    const live = state.active?.startedAt && mockClock(state.active, Date.now()).phase === 'running';
    if (live && !confirmed) {
      setReplace({ key, request });
      return;
    }
    setBusy(key);
    try {
      const drawn = await ojRequest<Drawn>('mock-oa/draw', {
        ...request,
        exclude: recentIds(state),
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
        slots: drawn.slots,
        ids: drawn.ids,
        minutes: drawn.minutes,
        skew: drawn.now - now,
        createdAt: now,
      };
      // A replaced running mock is handed in as it stands; an unstarted draw is just dropped.
      const base =
        live && state.active ? archiveMock(state, finishMock(state.active, now)) : state;
      save({ ...base, active: session });
      navigate('mock', { session: session.id });
    } catch (e) {
      const message = (e as Error).message;
      setError(t(message, englishMessage(message)));
    } finally {
      setBusy(null);
    }
  }

  const report = findMock(state, params.report);
  const briefing = findMock(state, params.session);
  return (
    <div className="algorithm-library mock-oa">
      <LibrarySwitch section="mock" navigate={navigate} />
      {storageFailed && (
        <p className="mock-note" role="alert">
          {t(
            '浏览器存储不可用：本场模拟刷新后无法恢复，成绩也不会记录。',
            "Browser storage is unavailable: this mock won't survive a refresh and its result won't be kept.",
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
      {params.report ? (
        report?.finishedAt ? (
          <MockReport
            key={report.id}
            session={report}
            boot={boot}
            navigate={navigate}
            onResult={(result) => {
              const latest = readMockState(userId);
              const stored = findMock(latest, report.id) ?? report;
              save(archiveMock(latest, { ...stored, result }));
            }}
            again={() => draw('again', drawRequest(report))}
            busy={busy === 'again'}
          />
        ) : (
          <MissingSession navigate={navigate} />
        )
      ) : params.session && briefing && !briefing.startedAt ? (
        <MockBriefing
          session={briefing}
          preset={presets?.companies.find((c) => c.slug === briefing.company)}
          boot={boot}
          busy={busy === 'redraw'}
          redraw={() => draw('redraw', drawRequest(briefing))}
          cancel={() => {
            save({ ...state, active: null });
            navigate('mock');
          }}
          start={() => {
            const started = { ...briefing, startedAt: Date.now() };
            save({ ...state, active: started });
            track('mock_start', {
              company: started.preset ? started.company : 'custom',
              questions: started.ids.length,
              minutes: started.minutes,
              source: started.source,
            });
            navigate('problem', { problem: started.ids[0], mock: started.id });
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
          handIn={() => {
            if (!state.active) return;
            const done = finishMock(state.active, Date.now());
            save(archiveMock(state, done));
            navigate('mock', { report: done.id });
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
  handIn: () => void;
}) {
  const t = useT();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const clock = mockClock(session, now);
  if (clock.phase === 'finished') return null;
  const running = clock.phase === 'running';
  return (
    <div className="mock-live" data-warn={clock.warning || undefined}>
      <span className="mock-live-tag">
        <i aria-hidden="true" />
        {running ? t('进行中', 'In progress') : t('已抽题，待开始', 'Drawn, not started')}
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
            running
              ? navigate('problem', { problem: session.ids[0], mock: session.id })
              : navigate('mock', { session: session.id })
          }
        >
          {running ? t('继续作答', 'Resume') : t('去检录', 'Check in')}
          <ArrowRight size={16} />
        </button>
        {running && (
          <button type="button" className="mock-ghost" onClick={handIn}>
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
  handIn: () => void;
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
                    {extra && (
                      <p className="mock-extra" title={extra}>
                        <b>{t('编程之外（不模拟）：', 'Besides coding (not simulated): ')}</b>
                        {extra}
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
  const preset = presets.companies.find((c) => c.slug === company);
  const other = presets.others.find((c) => c.slug === company);
  // Custom mocks of another company draw from its OA and mapped LeetCode problems together.
  const pool = preset
    ? { mixed: preset.pool.total, oa: preset.pool.oa, lc: preset.pool.lc }[source]
    : other
      ? other.pool
      : { mixed: presets.all.oa + presets.all.lc, ...presets.all }[source];
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
        <div className="mock-custom-go">
          <span className="mock-pool">
            {t('题池', 'Pool')} <b>{pool}</b>
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
        <p>{t('最多保留 30 场，只存在这个浏览器里。', 'The last 30, kept in this browser only.')}</p>
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
                      <b>{s.result.score}</b>/{s.result.max}
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

function MockBriefing({
  session,
  preset,
  boot,
  busy,
  redraw,
  cancel,
  start,
}: {
  session: MockSession;
  preset?: Preset;
  boot: Boot;
  busy: boolean;
  redraw: () => void;
  cancel: () => void;
  start: () => void;
}) {
  const t = useT(),
    zh = useLocale() === 'zh';
  const known = new Set(boot.problems.map((p) => p.id));
  const missing = session.ids.some((id) => !known.has(id));
  const extra = preset ? extraSections(preset, zh) : '';
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
      <ul className="mock-rules">
        <li>
          <Timer size={16} aria-hidden="true" />
          {t(
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
          {extra
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
        <button type="button" className="mock-cta mock-cta-big" onClick={start} disabled={missing} autoFocus>
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
            return (
              <li key={id} data-state={state}>
                <span className="mock-q">Q{index + 1}</span>
                <span className="mock-result-title">
                  <strong>{summary ? problemTitle(summary, locale) : id}</strong>
                  <small>
                    {t(LEVEL_NAME[session.slots[index] ?? 'medium'][0], LEVEL_NAME[session.slots[index] ?? 'medium'][1])}
                    {item ? t(` · 提交 ${item.attempts} 次`, ` · ${item.attempts} submissions`) : ''}
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
        </ol>
        <p className="mock-footnote">
          {t(
            '部分分：判题遇到第一个未通过的用例就停止，所以按它之前通过的用例数计。成绩只统计开考到交卷之间的提交，只保存在这个浏览器里。',
            'Partial credit: the judge stops at the first failing test, so it counts the tests passed before that one. Only submissions between the start and the hand-in count, and the result is kept in this browser only.',
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
    </>
  );
}
