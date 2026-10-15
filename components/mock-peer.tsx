'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarPlus, Check, Clock3, Flag, Link2, Users, Video, X, Zap } from 'lucide-react';
import { api } from '@/lib/types';
import { calendar, escapeText, utcStamp, vevent } from '@/lib/ics';
import { useLocale } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { TEMPLATES } from '@/lib/mock-interview';
import {
  FOCUS_MAX, INSTANT_MINUTES, LEAD_HOURS, LEVELS, LEVEL_NAMES, SLOTS_MAX, WINDOW_HOURS, meetingUrl, type Level,
} from '@/lib/mock-peer';
import { STOP_NAMES } from '@/lib/route-stops';
import type { Navigate } from './learning';
import { ModeTabs } from './mock-modes';
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
import '@/app/redesign.css';
import '@/app/mock-interview.css';
import '@/app/mock-peer.css';

type T = (zh: string, en: string) => string;
const HOUR = 3600000;
type Round = { set: string; as: 'candidate' | 'interviewer' };
export type PeerPair = {
  id: string;
  kind: string;
  level: string;
  slot: number;
  /** When it starts: an instant pair starts when it matched, inside its hour. */
  start: number;
  partner: string;
  meetUrl: string;
  status: 'scheduled' | 'cancelled';
  rounds: [Round, Round];
  reported: boolean;
  reportedMe: boolean;
  canReport: boolean;
  canCancel: boolean;
};
export type PeerState = {
  request: {
    displayName: string;
    kind: string;
    level: string;
    slots: number[];
    /** "Practice now": it lapses INSTANT_MINUTES after createdAt. */
    instant: boolean;
    expired: boolean;
    createdAt: number;
  } | null;
  pairs: PeerPair[];
  paused: boolean;
};
const pad = (n: number) => String(n).padStart(2, '0');
const templateOf = (kind: string) => TEMPLATES.find((x) => x.id === kind);
/** Both rounds of the template, back to back. */
const minutesOf = (kind: string) => 2 * (templateOf(kind)?.slots.reduce((sum, s) => sum + s.minutes, 0) ?? 60);
export const roundHref = (kind: string, round: Round) =>
  `/?${new URLSearchParams({ view: 'mock-interview', template: kind, set: round.set, as: round.as })}`;

/**
 * The bookable UTC hours from `now` (LEAD_HOURS ahead to a week out) as a local timetable:
 * a column per local day, a row per local clock time (14:30 rows in half-hour zones), and the
 * slot behind each cell. ponytail: a DST change inside the week drops or doubles one row.
 */
export function slotGrid(now: number, english: boolean) {
  const hour = Math.floor(now / HOUR);
  const days: { key: string; label: string }[] = [];
  const rows = new Set<string>();
  const cells = new Map<string, number>();
  for (let slot = hour + LEAD_HOURS; slot <= hour + WINDOW_HOURS; slot++) {
    const d = new Date(slot * HOUR);
    const day = d.toDateString();
    if (days.at(-1)?.key !== day)
      days.push({
        key: day,
        label: d.toLocaleDateString(english ? 'en-US' : 'zh-CN', { weekday: 'short', month: 'numeric', day: 'numeric' }),
      });
    const row = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    rows.add(row);
    cells.set(`${day}|${row}`, slot);
  }
  return { days, rows: [...rows].sort(), cells };
}
const when = (ms: number, english: boolean) =>
  new Date(ms).toLocaleString(english ? 'en-US' : 'zh-CN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
/** An .ics event for the session, built in the browser. */
export function icsFor(pair: PeerPair, site: string, english: boolean) {
  const name = templateOf(pair.kind)?.name[english ? 1 : 0] ?? pair.kind;
  return calendar(
    ['VERSION:2.0', 'PRODID:-//CSWork//Peer mock interview//EN'],
    [
      vevent(`${pair.id}@cswork`, Date.now(), [
        `DTSTART:${utcStamp(pair.start)}`,
        `DTEND:${utcStamp(pair.start + minutesOf(pair.kind) * 60000)}`,
        `SUMMARY:${escapeText(english ? `CSWork peer mock interview: ${name}` : `CSWork 同伴模拟面试：${name}`)}`,
        `DESCRIPTION:${escapeText(`${english ? 'Partner' : '对方'}: ${pair.partner}\n${pair.meetUrl || site + '/?view=mock-peer&pair=' + pair.id}`)}`,
        `URL:${site}/?view=mock-peer&pair=${pair.id}`,
      ]),
    ],
  );
}

/** ?view=mock-peer: ask for a partner, then the sessions (&pair= highlights one). */
export function MockPeer({ navigate, params }: { navigate: Navigate; params: Record<string, string> }) {
  const english = useLocale() === 'en';
  const t: T = (zh, en) => (english ? en : zh);
  const [state, setState] = useState<PeerState | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    api<PeerState>('oj/peer').then(
      (s) => live && setState(s),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, []);
  async function run(path: string, body: unknown) {
    setBusy(true);
    setError('');
    try {
      setState(await api<PeerState>(path, body));
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  // An instant request is matched by someone else's: look again until it is, or it lapses.
  const instantWaiting = !!state?.request?.instant && !state.request.expired;
  useEffect(() => {
    if (!instantWaiting) return;
    const timer = setInterval(() => api<PeerState>('oj/peer').then(setState, () => {}), 10_000);
    return () => clearInterval(timer);
  }, [instantWaiting]);
  const [now] = useState(() => Date.now());
  const upcoming = state?.pairs.filter((p) => p.status === 'scheduled' && p.start + minutesOf(p.kind) * 60000 > now) ?? [];
  const past = state?.pairs.filter((p) => !upcoming.includes(p)) ?? [];
  return (
    <div className="rd mi peer" lang={english ? 'en' : 'zh'}>
      <div className="rd-page">
        <ModeTabs navigate={navigate} current="mock-peer" />
        <header className="rd-head rd-reveal" style={{ '--i': 0 } as React.CSSProperties}>
          <h1>{t('同伴互面', 'Peer mock interviews')}</h1>
          <p>
            {t(
              '选好面试类型、级别和有空的时段，系统把你和时间对得上的同学配成一对。一场两轮：你们各当一次候选人、一次面试官，题目各不相同。',
              'Pick an interview type, a level and the hours you’re free. We pair you with someone whose hours overlap. Two rounds: each of you is the candidate once and the interviewer once, on different questions.',
            )}
          </p>
        </header>
        {error && (
          <div className="js-error" role="alert">
            {t(error, englishMessage(error))}
          </div>
        )}
        {!state ? (
          !error && <output className="peer-loading">{t('正在加载…', 'Loading…')}</output>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section className="peer-section" aria-labelledby="peer-upcoming">
                <h2 id="peer-upcoming">{t('即将开始', 'Coming up')}</h2>
                {upcoming.map((pair) => (
                  <PairCard key={pair.id} pair={pair} focus={params.pair === pair.id} t={t} english={english} busy={busy} run={run} navigate={navigate} />
                ))}
              </section>
            )}
            {state.paused ? (
              <section className="rd-card peer-paused">
                <Flag size={16} aria-hidden="true" />
                <p>
                  {t(
                    '90 天内有两位同伴报告你没有出席，匹配暂停中。之后会自动恢复。',
                    'Two partners reported you missing in the last 90 days, so matching is paused. It resumes on its own.',
                  )}
                </p>
              </section>
            ) : state.request && !state.request.expired ? (
              <Waiting request={state.request} now={now} t={t} english={english} busy={busy} cancel={() => void run('oj/peer/cancel', {})} />
            ) : (
              <RequestForm
                t={t}
                english={english}
                busy={busy}
                submit={(body) => run('oj/peer', body)}
                lapsed={state.request ? (state.request.instant ? 'instant' : 'slots') : null}
              />
            )}
            {past.length > 0 && (
              <section className="peer-section" aria-labelledby="peer-past">
                <h2 id="peer-past">{t('之前的场次', 'Earlier sessions')}</h2>
                {past.map((pair) => (
                  <PairCard key={pair.id} pair={pair} focus={params.pair === pair.id} t={t} english={english} busy={busy} run={run} navigate={navigate} />
                ))}
              </section>
            )}
            <p className="peer-rules">
              {t(
                `规则：只匹配同一类型和级别；最多同时约 3 场；同伴只能看到你填的昵称。视频通话用你们自己的 Google Meet、Zoom 或腾讯会议链接。被两位不同的同伴报告爽约，会暂停匹配 90 天。`,
                'Rules: matches need the same type and level; up to 3 booked sessions at a time; partners see only the name you enter. Calls use your own Google Meet, Zoom or Tencent Meeting link. Two no-show reports from different partners pause matching for 90 days.',
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Waiting({
  request,
  now,
  t,
  english,
  busy,
  cancel,
}: {
  request: NonNullable<PeerState['request']>;
  now: number;
  t: T;
  english: boolean;
  busy: boolean;
  cancel: () => void;
}) {
  const ahead = request.slots.filter((s) => s * HOUR > now);
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    if (!request.instant) return;
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [request.instant]);
  const left = Math.max(0, Math.ceil((request.createdAt + INSTANT_MINUTES * 60000 - tick) / 1000));
  return (
    <section className="mi-board peer-waiting rd-reveal" aria-labelledby="peer-waiting-title">
      <div className="mi-board-controls">
        <p className="mi-field-label">
          <span className="peer-pulse" aria-hidden="true" /> {t('等待匹配', 'Waiting for a partner')}
        </p>
        <h2 id="peer-waiting-title">
          {t(...(templateOf(request.kind)?.name ?? [request.kind, request.kind]))} ·{' '}
          {t(...(LEVEL_NAMES[request.level as Level] ?? [request.level, request.level]))}
        </h2>
        {request.instant ? (
          <>
            <p className="peer-sub">
              {t(
                `${INSTANT_MINUTES} 分钟内有人也点了「现在就练」（同样的类型和级别），就会马上配对，这个页面会自动刷新。`,
                `If someone else picks Practice now with the same type and level in the next ${INSTANT_MINUTES} minutes, you’re paired at once; this page refreshes itself.`,
              )}
            </p>
            <p className="peer-countdown" role="timer" aria-label={t('匹配剩余时间', 'Time left to match')}>
              {pad(Math.floor(left / 60))}:{pad(left % 60)}
            </p>
          </>
        ) : (
          <>
            <p className="peer-sub">
              {t(
                '有人选了同样的类型、级别和重叠的时段，就会自动配对，并在站内消息里通知你。',
                'As soon as someone picks the same type and level with an overlapping hour, you’re paired and notified in your messages.',
              )}
            </p>
            <ul className="peer-chips" aria-label={t('你选的时段', 'Your hours')}>
              {ahead.map((s) => (
                <li key={s}>{when(s * HOUR, english)}</li>
              ))}
            </ul>
          </>
        )}
      </div>
      <div className="mi-ticket peer-ticket">
        <p className="mi-ticket-kicker">{t('昵称', 'Your name')}</p>
        <p className="mi-ticket-name">{request.displayName}</p>
        <button type="button" className="rd-button is-quiet peer-cancel" disabled={busy} onClick={cancel}>
          <X size={14} aria-hidden="true" />
          {t('撤回请求', 'Withdraw request')}
        </button>
      </div>
    </section>
  );
}

function RequestForm({
  t,
  english,
  busy,
  submit,
  lapsed,
}: {
  t: T;
  english: boolean;
  busy: boolean;
  submit: (body: unknown) => Promise<boolean>;
  /** The last request lapsed: its hours passed, or an instant one found nobody in time. */
  lapsed: 'slots' | 'instant' | null;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('phone');
  const [level, setLevel] = useState<Level>('new-grad');
  const [picked, setPicked] = useState<number[]>([]);
  const [remind, setRemind] = useState(true);
  const [companies, setCompanies] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  // Target companies to pick from (the report form's list), fetched when the focus section opens.
  const [known, setKnown] = useState<{ slug: string; name: string }[] | null>(null);
  const body = (instant: boolean) => ({
    displayName: name.trim(),
    kind,
    level,
    slots: instant ? [] : picked,
    tz: new Date().getTimezoneOffset(),
    remind,
    instant,
    focus: { companies, topics },
  });
  const [now] = useState(() => Date.now());
  const grid = useMemo(() => slotGrid(now, english), [now, english]);
  const full = picked.length >= SLOTS_MAX;
  const toggle = (slot: number) =>
    setPicked((list) => (list.includes(slot) ? list.filter((s) => s !== slot) : full ? list : [...list, slot]));
  return (
    <form
      className="mi-board peer-form rd-reveal"
      aria-label={t('预约同伴面试', 'Book a peer interview')}
      onSubmit={(e) => {
        e.preventDefault();
        void submit(body(false)).then((ok) => ok && setPicked([]));
      }}
    >
      <div className="mi-board-controls">
        {lapsed && (
          <p className="peer-note">
            {lapsed === 'instant'
              ? t(
                  `${INSTANT_MINUTES} 分钟内没有配上。可以再试一次，或者预约几个时段。`,
                  `Nobody matched within ${INSTANT_MINUTES} minutes. Try again, or book some hours.`,
                )
              : t('上次选的时段都过去了，重新选几个吧。', 'All the hours you picked last time have passed. Pick some new ones.')}
          </p>
        )}
        <fieldset className="mi-field">
          <legend className="mi-field-label">
            <b>01</b> {t('面试类型', 'Interview type')}
          </legend>
          <div className="mi-seg">
            {TEMPLATES.map((x) => (
              <button key={x.id} type="button" aria-pressed={kind === x.id} onClick={() => setKind(x.id)}>
                {t(...x.name)}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="mi-field">
          <legend className="mi-field-label">
            <b>02</b> {t('级别', 'Level')}
          </legend>
          <div className="mi-seg">
            {LEVELS.map((id) => (
              <button key={id} type="button" aria-pressed={level === id} onClick={() => setLevel(id)}>
                {t(...LEVEL_NAMES[id])}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="mi-field">
          <legend className="mi-field-label">
            <b>03</b> {t('有空的时段（你的当地时间）', 'Hours you’re free (your local time)')}{' '}
            <b>
              {picked.length}/{SLOTS_MAX}
            </b>
          </legend>
          <div className="peer-grid-scroll" tabIndex={0} role="region" aria-label={t('时段表', 'Timetable')}>
            <table className="peer-grid">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">{t('时间', 'Time')}</span>
                  </th>
                  {grid.days.map((d) => (
                    <th key={d.key} scope="col">
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((row) => (
                  <tr key={row}>
                    <th scope="row">{row}</th>
                    {grid.days.map((d) => {
                      const slot = grid.cells.get(`${d.key}|${row}`);
                      const on = slot !== undefined && picked.includes(slot);
                      return (
                        <td key={d.key}>
                          {slot !== undefined && (
                            <button
                              type="button"
                              aria-pressed={on}
                              aria-label={`${d.label} ${row}`}
                              disabled={!on && full}
                              onClick={() => toggle(slot)}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>
        <details
          className="peer-focus"
          onToggle={(e) => {
            if (!e.currentTarget.open || known) return;
            api<{ items: { slug: string; name: string }[] }>('oj/reports/companies').then(
              (r) => setKnown(r.items),
              () => setKnown([]),
            );
          }}
        >
          <summary className="mi-field-label">
            <b>04</b> {t('优先匹配（可选）', 'Match me first with (optional)')}
          </summary>
          <p className="peer-sub">
            {t(
              `最多 ${FOCUS_MAX} 家目标公司、${FOCUS_MAX} 个想练的话题。有交集的同学优先配对，没有也照样能配上。`,
              `Up to ${FOCUS_MAX} target companies and ${FOCUS_MAX} topics. People who share them are matched first; you still match without them.`,
            )}
          </p>
          <label className="mi-field">
            <span className="mi-field-label">{t('目标公司', 'Target companies')}</span>
            <select
              value=""
              disabled={!known || companies.length >= FOCUS_MAX}
              onChange={(e) => e.target.value && setCompanies([...companies, e.target.value])}
            >
              <option value="">{known ? t('加一家公司…', 'Add a company…') : t('正在加载…', 'Loading…')}</option>
              {known
                ?.filter((c) => !companies.includes(c.slug))
                .map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          {companies.length > 0 && (
            <div className="mi-seg">
              {companies.map((slug) => {
                const label = known?.find((c) => c.slug === slug)?.name ?? slug;
                return (
                  <button
                    key={slug}
                    type="button"
                    aria-label={t(`移除 ${label}`, `Remove ${label}`)}
                    onClick={() => setCompanies(companies.filter((c) => c !== slug))}
                  >
                    {label} <X size={12} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}
          <fieldset className="mi-seg peer-topics">
            <legend className="sr-only">{t('话题', 'Topics')}</legend>
            {Object.entries(STOP_NAMES).map(([slug, [zh, en]]) => {
              const on = topics.includes(slug);
              return (
                <button
                  key={slug}
                  type="button"
                  aria-pressed={on}
                  disabled={!on && topics.length >= FOCUS_MAX}
                  onClick={() => setTopics(on ? topics.filter((x) => x !== slug) : [...topics, slug])}
                >
                  {t(zh, en)}
                </button>
              );
            })}
          </fieldset>
        </details>
      </div>
      <div className="mi-ticket peer-ticket">
        <p className="mi-ticket-kicker">{t('一场两轮', 'Two rounds')}</p>
        <ol className="mi-ticket-slots">
          <li>
            <span>{t('第 1 轮：一人当候选人', 'Round 1: one of you is the candidate')}</span>
          </li>
          <li>
            <span>{t('第 2 轮：交换角色、换一套题', 'Round 2: swap roles, new questions')}</span>
          </li>
        </ol>
        <p className="mi-ticket-total">
          <span className="mi-led-small">{minutesOf(kind)}</span> {t('分钟', 'min')}
        </p>
        <label className="peer-name">
          <span>{t('给同伴看的昵称', 'The name your partner sees')}</span>
          <input value={name} maxLength={24} required onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="peer-remind">
          <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} />
          {t('开始前一天和一小时发邮件提醒我', 'Email reminders a day and an hour before')}
        </label>
        <button type="submit" className="mi-cta" disabled={busy || !name.trim() || !picked.length}>
          <Users size={17} aria-hidden="true" />
          {busy ? t('正在匹配…', 'Matching…') : t('帮我找同伴', 'Find me a partner')}
        </button>
        <button type="button" className="rd-button is-quiet peer-now" disabled={busy || !name.trim()} onClick={() => void submit(body(true))}>
          <Zap size={15} aria-hidden="true" />
          {t(`现在就练（${INSTANT_MINUTES} 分钟内匹配）`, `Practice now (match within ${INSTANT_MINUTES} min)`)}
        </button>
      </div>
    </form>
  );
}

type Confirm = 'cancel' | 'no-show' | null;

function PairCard({
  pair,
  focus,
  t,
  english,
  busy,
  run,
  navigate,
}: {
  pair: PeerPair;
  focus: boolean;
  t: T;
  english: boolean;
  busy: boolean;
  run: (path: string, body: unknown) => Promise<boolean>;
  navigate: Navigate;
}) {
  // The typed link until it is saved; then the session's own again.
  const [draft, setDraft] = useState<string | null>(null);
  const link = draft ?? pair.meetUrl;
  const [confirm, setConfirm] = useState<Confirm>(null);
  const card = useRef<HTMLElement>(null);
  // A notification's link (&pair=) brings its session into view once.
  useEffect(() => {
    if (focus) card.current?.scrollIntoView?.({ block: 'center' });
  }, [focus]);
  const linkOk = link.trim() === '' || meetingUrl(link.trim());
  const scheduled = pair.status === 'scheduled';
  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([icsFor(pair, location.origin, english)], { type: 'text/calendar' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `cswork-peer-${pair.id}.ics` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      // No Blob URLs here (an old browser or a sandbox): nothing to download.
    }
  };
  return (
    <article
      className="peer-pass"
      data-status={pair.status}
      data-focus={focus || undefined}
      ref={card}
    >
      <header>
        <p className="peer-pass-kicker">
          {t(...(templateOf(pair.kind)?.name ?? [pair.kind, pair.kind]))} ·{' '}
          {t(...(LEVEL_NAMES[pair.level as Level] ?? [pair.level, pair.level]))}
        </p>
        <p className="peer-pass-time">
          <Clock3 size={15} aria-hidden="true" />
          <time dateTime={new Date(pair.start).toISOString()}>{when(pair.start, english)}</time>
          {!scheduled && <span className="peer-tag">{t('已取消', 'Cancelled')}</span>}
        </p>
        <p className="peer-pass-partner">
          {t('同伴', 'Partner')} <strong>{pair.partner}</strong>
        </p>
      </header>
      <ol className="peer-rounds">
        {pair.rounds.map((round, i) => (
          <li key={round.set} data-as={round.as}>
            <span className="peer-round-n">{t(`第 ${i + 1} 轮`, `Round ${i + 1}`)}</span>
            <span>{round.as === 'candidate' ? t('你当候选人', 'You’re the candidate') : t('你当面试官', 'You interview')}</span>
            <a
              href={roundHref(pair.kind, round)}
              onClick={(e) => {
                if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                navigate('mock-interview', { template: pair.kind, set: round.set, as: round.as });
              }}
            >
              {round.as === 'candidate' ? t('打开候选人页面', 'Open the candidate page') : t('打开面试官页面（含答案）', 'Open the interviewer page (answers)')}
            </a>
          </li>
        ))}
      </ol>
      {pair.meetUrl && (
        <a className="peer-join" href={pair.meetUrl} target="_blank" rel="noopener noreferrer nofollow">
          <Video size={15} aria-hidden="true" />
          {t('进入视频会议', 'Join the call')}
        </a>
      )}
      {scheduled && (
        <form
          className="peer-link"
          onSubmit={(e) => {
            e.preventDefault();
            if (linkOk) void run(`oj/peer/${pair.id}/link`, { url: link.trim() }).then((ok) => ok && setDraft(null));
          }}
        >
          <label>
            <span>{t('会议链接（Meet / Zoom / 腾讯会议）', 'Call link (Meet / Zoom / Tencent Meeting)')}</span>
            <input
              type="url"
              value={link}
              maxLength={500}
              placeholder="https://meet.google.com/…"
              aria-invalid={!linkOk || undefined}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <button type="submit" className="rd-button is-quiet" disabled={busy || !linkOk || link.trim() === pair.meetUrl}>
            <Link2 size={14} aria-hidden="true" />
            {t('保存链接', 'Save link')}
          </button>
          {!linkOk && (
            <p className="peer-hint" role="alert">
              {t('只支持 Google Meet、Zoom、Teams、腾讯会议、Whereby 和 Jitsi 的 https 链接。', 'Only https links to Google Meet, Zoom, Teams, Tencent Meeting, Whereby or Jitsi.')}
            </p>
          )}
        </form>
      )}
      {pair.reportedMe && (
        <p className="peer-hint">
          {t(
            '对方报告你没有出席这场面试。如果其实是对方没来，也可以报告对方；互相报告的场次不计入暂停。',
            'Your partner reported that you missed this session. If they were the one missing, report them too: sessions reported both ways don’t count toward a pause.',
          )}
        </p>
      )}
      <div className="peer-actions">
        {scheduled && (
          <button type="button" className="rd-button is-quiet" onClick={download}>
            <CalendarPlus size={14} aria-hidden="true" />
            {t('加到日历', 'Add to calendar')}
          </button>
        )}
        {pair.canCancel && (
          <button type="button" className="rd-button is-quiet" disabled={busy} onClick={() => setConfirm('cancel')}>
            <X size={14} aria-hidden="true" />
            {t('取消这场', 'Cancel session')}
          </button>
        )}
        {pair.canReport && (
          <button type="button" className="rd-button is-quiet" disabled={busy} onClick={() => setConfirm('no-show')}>
            <Flag size={14} aria-hidden="true" />
            {t('对方没来', 'Partner didn’t show')}
          </button>
        )}
        {pair.reported && (
          <span className="peer-tag">
            <Check size={13} aria-hidden="true" /> {t('已报告爽约', 'No-show reported')}
          </span>
        )}
      </div>
      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === 'cancel' ? t('取消这场同伴面试？', 'Cancel this session?') : t('报告对方没有出席？', 'Report a no-show?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'cancel'
                ? t(`${pair.partner} 会收到站内通知。`, `${pair.partner} gets a notification.`)
                : t(
                    '每场只能报告一次。被两位不同的同伴报告，对方会暂停匹配 90 天；请只在对方确实没来时报告。',
                    'One report per session. Two reports from different partners pause their matching for 90 days, so only report a real no-show.',
                  )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('返回', 'Back')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirm && void run(`oj/peer/${pair.id}/${confirm}`, {})}>
              {confirm === 'cancel' ? t('取消这场', 'Cancel session') : t('报告', 'Report')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
