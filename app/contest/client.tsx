'use client';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { CONTEST_KINDS, isRatedKind, RATE_GRACE, weeklyTitle } from '@/lib/contest';
import { contestName } from '@/lib/lc-rating';
import { formatClock } from '@/lib/mock-oa';
import { useLocale, useT } from '@/lib/i18n';
import { api } from '@/lib/types';
import type { RoomView } from '@/lib/server/contests';
import type { DuelQueueState } from '@/lib/server/duels';
import { penaltyText } from '@/components/contest-parts';
import { RatingBadge } from '@/components/rating-badge';

type T = (zh: string, en: string) => string;
const everySecond = (tick: () => void) => {
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
};
const noop = () => () => {};
/** The clock to the second; null in the server's HTML. */
function useNow() {
  return useSyncExternalStore(everySecond, () => Math.floor(Date.now() / 1000) * 1000, () => null);
}

/** A moment in the reader's own zone; `fallback` (Beijing time) in the server's HTML. */
export function LocalTime({ at, fallback }: { at: number; fallback: string }) {
  const locale = useLocale();
  const text = useSyncExternalStore(
    noop,
    () =>
      new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(at),
    () => fallback,
  );
  return <time dateTime={new Date(at).toISOString()}>{text}</time>;
}

/** "2d 03:14:22" as flap tiles; `skew` is server time minus this browser's. */
export function Countdown({ to, skew = 0, label }: { to: number; skew?: number; label: string }) {
  const t = useT();
  const now = useNow();
  if (now === null) return null;
  const left = Math.max(0, to - now - skew);
  const days = Math.floor(left / 86400000);
  const clock = formatClock(left % 86400000).padStart(5, '0');
  return (
    <p className="contest-countdown">
      <span className="contest-countdown-label">{label}</span>
      <span role="timer" aria-label={`${label} ${days ? t(`${days} 天 `, `${days}d `) : ''}${clock}`}>
        {days > 0 && (
          <span className="contest-flap" aria-hidden="true">
            {days}
            <small>{t('天', 'd')}</small>
          </span>
        )}
        {clock.split(':').map((part, i) => (
          <span key={i} className="contest-flap" aria-hidden="true">
            {part}
          </span>
        ))}
      </span>
    </p>
  );
}

const kindLabel = (kind: RoomView['kind'], t: T) => {
  const [zh, en] = CONTEST_KINDS[kind];
  return t(zh, en);
};
const PHASE: Record<RoomView['phase'], [string, string]> = {
  upcoming: ['未开赛', 'Upcoming'],
  running: ['进行中', 'Live'],
  ended: ['已结束', 'Finished'],
};

/** A contest name; `shareable` adds the opt-in to show one's accepted code after the room. */
function NameForm({
  suggested,
  submit,
  label,
  shareable = false,
  t,
}: {
  suggested: string;
  submit: (name: string, shareCode: boolean) => Promise<void>;
  label: string;
  shareable?: boolean;
  t: T;
}) {
  const [name, setName] = useState(suggested);
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function go(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await submit(name.trim(), share);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="contest-join" onSubmit={go}>
      <label>
        <span>{t('比赛昵称（计分板上公开显示）', 'Contest name (shown on the scoreboard)')}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} required />
      </label>
      {shareable && <ShareCode checked={share} onChange={setShare} t={t} />}
      <button type="submit" disabled={busy || !name.trim()}>
        {label}
      </button>
      {error && (
        <p className="contest-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function ShareCode({ checked, onChange, t }: { checked: boolean; onChange: (on: boolean) => void; t: T }) {
  return (
    <label className="contest-inline">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{t('赛后公开我的 AC 代码', 'Show my accepted code after the contest')}</span>
    </label>
  );
}

const problemHref = (id: string, room: string | null) =>
  `/?${new URLSearchParams(room ? { view: 'problem', problem: id, room } : { view: 'problem', problem: id, tab: 'solutions' })}`;

type Row = NonNullable<RoomView['standings']>['live'][number];

/**
 * One standings table: rank, name, solved, time, then a cell per question. `overall`: filtered
 * rows keep their overall rank. `onCode` opens the code a row shared for a question it solved.
 */
function Board({
  rows,
  count,
  caption,
  rated,
  overall = false,
  onCode,
  t,
}: {
  rows: Row[];
  count: number;
  caption: string;
  rated: boolean;
  overall?: boolean;
  onCode?: (question: number, name: string) => void;
  t: T;
}) {
  const qs = Array.from({ length: count }, (_, i) => `Q${i + 1}`);
  return (
    <div className="contest-board-wrap" role="region" aria-label={caption} tabIndex={0}>
      <table className="contest-board">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{overall ? t('全局名次', 'Overall') : '#'}</th>
            <th scope="col">{t('昵称', 'Name')}</th>
            <th scope="col">{t('通过', 'Solved')}</th>
            <th scope="col">{t('罚时', 'Time')}</th>
            {qs.map((q) => (
              <th key={q} scope="col">
                {q}
              </th>
            ))}
            {rated && <th scope="col">{t('Rating 变化', 'Rating')}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} data-me={r.me || undefined}>
              <td className="contest-rank">{r.rank}</td>
              <th scope="row">
                {r.name}
                {r.me && <small>{t('你', 'you')}</small>}
                {r.unrated && <small className="contest-unrated">{t('不计分', 'unrated')}</small>}
              </th>
              <td className="contest-solved">{r.solved}</td>
              <td className="contest-time">{r.solved ? penaltyText(r.penalty) : '—'}</td>
              {r.cells.map((c, k) => {
                const state = c.solved ? 'ac' : c.pending ? 'pending' : c.wrong ? 'wrong' : 'none';
                return (
                  <td key={k} className="contest-cell" data-state={state}>
                    {c.solved ? (
                      <>
                        {formatClock(c.at ?? 0)}
                        {!!c.wrong && <small> (-{c.wrong})</small>}
                        {onCode && r.shared && (
                          <button
                            type="button"
                            className="contest-code-link"
                            aria-label={t(`看 ${r.name} 的 Q${k + 1} 代码`, `${r.name}'s Q${k + 1} code`)}
                            onClick={() => onCode(k, r.name)}
                          >
                            {t('看代码', 'Code')}
                          </button>
                        )}
                      </>
                    ) : c.wrong ? (
                      `-${c.wrong}`
                    ) : c.pending ? (
                      '…'
                    ) : (
                      ''
                    )}
                    <span className="sr-only">
                      {c.solved
                        ? t(`通过，错 ${c.wrong} 次`, `solved, ${c.wrong} wrong`)
                        : c.pending
                          ? t('判题中', 'judging')
                          : c.wrong
                            ? t(`错 ${c.wrong} 次`, `${c.wrong} wrong`)
                            : t('未提交', 'no attempt')}
                    </span>
                  </td>
                );
              })}
              {rated && (
                <td className="contest-delta">
                  {r.rating ? (
                    <>
                      {r.rating.after - r.rating.before >= 0 ? '+' : ''}
                      {r.rating.after - r.rating.before}
                      <small> → {r.rating.after}</small>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Shared = { name: string; virtual: boolean; language: string; code: string; at: number };

/**
 * /contest/<id>: the room, polled every 10 seconds while anything can still change (every
 * minute before the start, when only the entrant count moves), and once more as soon as the
 * start, the end or the reader's own virtual run is reached. A waiting duel polls every 10
 * seconds for its opponent.
 */
export function RoomLive({ initial, fallbackStart }: { initial: RoomView; fallbackStart: string }) {
  const t = useT();
  const zh = useLocale() === 'zh';
  const [view, setView] = useState(initial);
  const [skew, setSkew] = useState(0);
  const [error, setError] = useState('');
  const [following, setFollowing] = useState(false);
  const [code, setCode] = useState<{ question: number; name: string; items: Shared[] } | null>(null);
  const codeHeading = useRef<HTMLHeadingElement>(null);
  const id = view.id;
  const refresh = useCallback(
    async (only = following) => {
      const sent = Date.now();
      const next = await api<RoomView>(`oj/contests/${encodeURIComponent(id)}${only ? '?following=1' : ''}`);
      setView(next);
      setSkew(next.now - (sent + Date.now()) / 2);
      setError('');
    },
    [id, following],
  );
  useEffect(() => codeHeading.current?.focus(), [code]);
  const myEnd = view.me?.end ?? 0;
  const active =
    view.phase !== 'ended' ||
    view.now < myEnd + 60000 ||
    ((isRatedKind(view.kind) || view.ranked) && !view.rated && view.now < view.endsAt + RATE_GRACE + 600000);
  const every = view.phase === 'upcoming' && !view.waiting ? 60000 : 10000;
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      if (document.visibilityState === 'visible')
        refresh().catch((e: Error) => setError(e.message));
    };
    const timer = setInterval(tick, every);
    document.addEventListener('visibilitychange', tick);
    // The moment the board changes phase (start, end, the reader's own end), not 10 s later.
    const next = [view.startsAt, view.endsAt, myEnd].filter((at) => at > view.now).sort((a, b) => a - b)[0];
    const edge = next ? setTimeout(tick, Math.min(2 ** 31 - 1, next - view.now + 1000)) : undefined;
    return () => {
      clearInterval(timer);
      clearTimeout(edge);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [active, every, refresh, view.startsAt, view.endsAt, view.now, myEnd]);

  const mine = view.me && view.now >= view.me.start && view.now < view.me.end;
  const title = view.week ? weeklyTitle(view.week, zh, view.kind) : view.ranked ? t('1v1 排位赛', 'Ranked duel') : view.title;
  const clock =
    view.phase === 'upcoming'
      ? view.startsAt > view.now
        ? { to: view.startsAt, label: t('距开赛', 'Starts in') }
        : null
      : mine && view.me!.virtual
        ? { to: view.me!.end, label: t('虚拟赛剩余', 'Your virtual run ends in') }
        : view.phase === 'running'
          ? { to: view.endsAt, label: t('距结束', 'Ends in') }
          : null;
  const join = async (displayName: string, shareCode: boolean) => {
    setView(await api<RoomView>(`oj/contests/${encodeURIComponent(id)}/join`, { displayName, shareCode }));
  };
  const showCode = async (question: number, name: string) => {
    try {
      const problem = view.problems![question].id;
      const found = await api<{ items: Shared[] }>(`oj/contests/${encodeURIComponent(id)}/code?${new URLSearchParams({ problem, name })}`);
      setCode({ question, name, items: found.items });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const onCode = view.codeOpen && view.problems ? showCode : undefined;
  const invite = view.inviteCode ? `/contest?join=${view.inviteCode}` : '';
  return (
    <article className="contest-room">
      <section className="lists-public-hero contest-hero" data-phase={view.phase}>
        <p className="lists-public-kicker">
          {kindLabel(view.kind, t)} · {t(...PHASE[view.phase])}
        </p>
        <h1>{title}</h1>
        <dl className="contest-facts">
          <div>
            <dt>{t('开赛', 'Starts')}</dt>
            <dd>
              <LocalTime at={view.startsAt} fallback={fallbackStart} />
            </dd>
          </div>
          <div>
            <dt>{t('时长', 'Length')}</dt>
            <dd>{t(`${view.durationMin} 分钟`, `${view.durationMin} min`)}</dd>
          </div>
          <div>
            <dt>{t('参赛', 'Entrants')}</dt>
            <dd>
              {view.entrants}
              {view.cap ? ` / ${view.cap}` : ''}
            </dd>
          </div>
          <div>
            <dt>{t('题目', 'Questions')}</dt>
            <dd>{view.problemCount}</dd>
          </div>
        </dl>
        {clock && <Countdown to={clock.to} skew={skew} label={clock.label} />}
        {view.me ? (
          <p className="contest-me">
            {view.me.virtual
              ? t(`你以「${view.me.name}」虚拟参赛，计时从你加入时开始。`, `You're running this virtually as “${view.me.name}”, timed from when you joined.`)
              : t(`你已以「${view.me.name}」报名。`, `You're in as “${view.me.name}”.`)}
          </p>
        ) : view.canJoin ? (
          <NameForm
            suggested={view.suggestedName}
            submit={join}
            shareable
            t={t}
            label={
              view.phase === 'upcoming'
                ? t('报名参赛', 'Enter the contest')
                : t(`虚拟参赛（从现在起 ${view.durationMin} 分钟）`, `Run it virtually (${view.durationMin} min from now)`)
            }
          />
        ) : (
          view.visibility === 'public' &&
          !view.owner && (
            <a className="lists-public-cta" href="/?view=account">
              {t('登录后报名', 'Sign in to enter')}
            </a>
          )
        )}
        {invite && (
          <p className="contest-invite">
            {t('邀请码', 'Invite code')} <code>{view.inviteCode}</code>{' '}
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(location.origin + invite).catch(() => {})}
            >
              {t('复制邀请链接', 'Copy invite link')}
            </button>
          </p>
        )}
      </section>

      {error && (
        <p className="contest-error" role="alert">
          {error}
        </p>
      )}
      {view.kind === 'duel' && view.phase !== 'upcoming' && (
        <output className="contest-winner">
          {view.winner
            ? t(`${view.winner} 率先通过全部题目，赢下对战`, `${view.winner} solved everything first and wins the duel`)
            : !view.ranked
              ? t('先通过全部题目的一方获胜；都没做完则按计分板。', 'First to solve every question wins; otherwise the scoreboard decides.')
              : view.rated
                ? t('时间到，双方都没做完：平局。', "Time's up with neither done: a draw.")
                : t('先通过全部题目的一方获胜；时间到都没做完算平局。', 'First to solve every question wins; a draw if time runs out first.')}
        </output>
      )}

      {view.problems ? (
        <section aria-labelledby="contest-problems">
          <h2 id="contest-problems" className="lists-public-h2">
            {t('题目', 'Questions')}
            {view.phase === 'ended' && <small>{t('赛后补题：每题都可看社区题解', 'Upsolve: each links to its community solutions')}</small>}
          </h2>
          <ol className="contest-problems">
            {view.problems.map((p, i) => (
              <li key={p.id}>
                <span className="contest-q">Q{i + 1}</span>
                <a href={problemHref(p.id, mine ? id : null)}>{zh ? p.title : p.titleEn || p.title}</a>
                <RatingBadge rating={p.rating} english={!zh} />
                <span className="contest-go">{mine ? t('去作答', 'Solve') : t('补题 · 题解', 'Upsolve · solutions')}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <p className="contest-hidden-note">
          {view.waiting
            ? t('对手加入后开赛，题目同时公布。', 'The duel starts, and its questions appear, when your opponent joins.')
            : view.phase === 'upcoming'
              ? t('题目在开赛时公布。', 'Questions appear when the contest starts.')
              : t('报名后即可看到题目。', 'Enter to see the questions.')}
        </p>
      )}

      {view.standings && (
        <section aria-labelledby="contest-standings" className="contest-standings">
          <h2 id="contest-standings" className="lists-public-h2">
            {t('计分板', 'Scoreboard')}
            <small>
              {view.phase === 'running' ? t('每 10 秒刷新', 'Refreshes every 10 seconds') : ''}
              {isRatedKind(view.kind) && view.phase === 'ended' && !view.rated
                ? t('结束 15 分钟后结算 rating', 'Ratings settle 15 minutes after the end')
                : ''}
            </small>
          </h2>
          {view.following !== null && view.kind !== 'duel' && (
            <label className="contest-inline contest-follow">
              <input
                type="checkbox"
                checked={following}
                onChange={(e) => {
                  const on = e.target.checked;
                  setFollowing(on);
                  refresh(on).catch((err: Error) => setError(err.message));
                }}
              />
              <span>{t('只看我关注的人（对方主页需展示比赛记录）', 'Only people I follow (whose profile shows contests)')}</span>
            </label>
          )}
          {view.standings.live.length ? (
            <Board
              rows={view.standings.live}
              count={view.problemCount}
              caption={t('实时参赛', 'Live')}
              rated={view.rated}
              overall={!!view.following}
              onCode={onCode}
              t={t}
            />
          ) : (
            <p className="contest-hidden-note">{t('还没有实时参赛的人。', 'Nobody raced this live.')}</p>
          )}
          {view.standings.virtual.length > 0 && (
            <Board
              rows={view.standings.virtual}
              count={view.problemCount}
              caption={t('虚拟参赛（各自计时，不计 rating）', 'Virtual (own clocks, unrated)')}
              rated={false}
              overall={!!view.following}
              onCode={onCode}
              t={t}
            />
          )}
        </section>
      )}

      {code && (
        <section aria-labelledby="contest-code" className="contest-code">
          <h2 id="contest-code" className="lists-public-h2" tabIndex={-1} ref={codeHeading}>
            {t(`Q${code.question + 1} 公开的代码`, `Q${code.question + 1}: shared code`)}
            <small>
              <button type="button" onClick={() => setCode(null)}>
                {t('收起', 'Close')}
              </button>
            </small>
          </h2>
          {code.items.length ? (
            code.items.map((item) => (
              <details key={item.name} open={item.name === code.name}>
                <summary>
                  {item.name} · {item.language} · {formatClock(item.at)}
                  {item.virtual ? t(' · 虚拟参赛', ' · virtual') : ''}
                </summary>
                <pre>
                  <code>{item.code}</code>
                </pre>
              </details>
            ))
          ) : (
            <p className="contest-hidden-note">{t('这道题还没有人公开代码。', 'Nobody has shared code for this question.')}</p>
          )}
        </section>
      )}

      <details className="contest-rules">
        <summary>{t('计分规则', 'Scoring rules')}</summary>
        <ul>
          <li>{t('按通过题数排名；题数相同比罚时，罚时少者在前。', 'Ranked by questions solved, then by time: less is better.')}</li>
          <li>
            {t(
              '罚时 = 每题首次通过的用时之和 + 该题通过前每次错误提交 5 分钟（编译错误不罚）。',
              'Time = the sum of each solve’s minutes from the start, plus 5 minutes per wrong submission before it (compile errors are free).',
            )}
          </li>
          <li>
            {t(
              '开赛前报名是实时参赛；开赛后加入是虚拟参赛，从加入时起计时，单独排名，不计 rating。',
              'Enter before the start to race live; joining once it has started is a virtual run on your own clock, ranked separately and unrated.',
            )}
          </li>
          {view.kind === 'duel' && (
            <li>{t('对战在第二个人加入时开始计时。', 'A duel’s clock starts when the second player joins.')}</li>
          )}
          {view.ranked && (
            <li>
              {t(
                '排位对战按两人 Elo（K=32）结算对战 rating，初始 1500，与周赛 rating 分开；同一对选手每天最多匹配 3 场。',
                'Ranked duels move a duel rating by two-player Elo (K = 32), starting at 1500 and apart from the weekly rating; the same pair is matched at most 3 times a day.',
              )}
            </li>
          )}
          {isRatedKind(view.kind) && (
            <li>
              {t(
                '周赛和入门赛共用一套 Elo，结束后结算：有提交的实时参赛者参与，初始 1500，场次越多波动越小。',
                'Weeklies and starters share one Elo, rated once they end: live entrants with a submission count, everyone starts at 1500, and ratings settle as you race more.',
              )}
            </li>
          )}
          {view.kind === 'starter' && (
            <li>
              {t(
                '入门赛只给赛前 rating 低于 1700 的人计分；其他人照常上榜，标「不计分」。',
                'A starter rates only entrants below 1700 before it; everyone else is on the board, marked unrated.',
              )}
            </li>
          )}
          <li>
            {t(
              '报名时可选赛后公开自己的 AC 代码；比赛结束 15 分钟后，登录的人能在计分板上点「看代码」。',
              'When entering you can choose to show your accepted code afterwards; 15 minutes after the end, signed-in readers open it from the scoreboard.',
            )}
          </li>
        </ul>
      </details>
    </article>
  );
}

/** The lobby's weekly card: countdown and the way in. */
export function WeeklyClock({ startsAt, endsAt, now }: { startsAt: number; endsAt: number; now: number }) {
  const t = useT();
  const clock = useNow();
  const at = clock ?? now;
  if (at >= endsAt) return null;
  return at < startsAt ? (
    <Countdown to={startsAt} label={t('距发车', 'Departs in')} />
  ) : (
    <Countdown to={endsAt} label={t('进行中 · 距结束', 'Live · ends in')} />
  );
}

/** Join a private room with its code: preview first, then a name. */
export function JoinByCode({ initialCode, suggested }: { initialCode: string; suggested: string }) {
  const t = useT();
  const [code, setCode] = useState(initialCode);
  type Preview = { id: string; title: string; kind: RoomView['kind']; entrants: number; full: boolean };
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const look = useCallback(async (value: string) => {
    try {
      const found = await api<Preview>(`oj/contests/preview?${new URLSearchParams({ code: value })}`);
      setError('');
      setPreview(found);
    } catch (e) {
      setPreview(null);
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    // A shared /contest?join=<code> link looks the room up straight away.
    if (initialCode) void look(initialCode);
  }, [initialCode, look]);
  return (
    <div className="contest-card">
      <form
        className="contest-join"
        onSubmit={(e) => {
          e.preventDefault();
          void look(code.trim());
        }}
      >
        <label>
          <span>{t('邀请码', 'Invite code')}</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={12} autoCapitalize="characters" spellCheck={false} required />
        </label>
        <button type="submit">{t('查找房间', 'Find room')}</button>
      </form>
      {error && (
        <p className="contest-error" role="alert">
          {error}
        </p>
      )}
      {preview && (
        <div className="contest-preview" aria-live="polite">
          <p>
            <b>{preview.title}</b> · {kindLabel(preview.kind, t)} · {t(`${preview.entrants} 人`, `${preview.entrants} in`)}
          </p>
          {preview.full ? (
            <p className="contest-error">{t('房间已满', 'This room is full')}</p>
          ) : (
            <NameForm
              suggested={suggested}
              t={t}
              label={t('加入房间', 'Join room')}
              shareable
              submit={async (displayName, shareCode) => {
                const room = await api<RoomView>('oj/contests/join', { code: code.trim(), displayName, shareCode });
                location.assign(`/contest/${encodeURIComponent(room.id)}`);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

type Hit = { id: string; title: string; titleEn: string | null; difficulty: string; rating: number | null };
const DURATIONS = [30, 45, 60, 90, 120, 180];

/** Open a mashup or a duel: picked, random or a past LeetCode weekly's problems. */
export function CreateRoom({
  replays,
  suggested,
  verified,
}: {
  replays: { code: string; count: number }[];
  suggested: string;
  verified: boolean;
}) {
  const t = useT();
  const zh = useLocale() === 'zh';
  const [kind, setKind] = useState<'mashup' | 'duel'>('mashup');
  const [source, setSource] = useState<'pick' | 'draw' | 'replay'>('pick');
  const [title, setTitle] = useState('');
  const [name, setName] = useState(suggested);
  const [picked, setPicked] = useState<Hit[]>([]);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [questions, setQuestions] = useState(3);
  const [pool, setPool] = useState<'mixed' | 'lc' | 'oa'>('mixed');
  const [replay, setReplay] = useState(replays[0]?.code ?? '');
  const [later, setLater] = useState(false);
  const [startAt, setStartAt] = useState('');
  const [duration, setDuration] = useState(90);
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    let current = true;
    const timer = setTimeout(() => {
      api<{ items: Hit[] }>(`oj/contests/search?${new URLSearchParams({ q })}`)
        .then((r) => current && setHits(r.items))
        .catch(() => current && setHits([]));
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query]);
  if (!verified)
    return <p className="contest-hidden-note">{t('验证邮箱后可以开房间。', 'Verify your email to open a room.')}</p>;
  const label = (h: Hit) => `${h.id.startsWith('lc-') ? `${h.id.slice(3)}. ` : ''}${zh ? h.title : h.titleEn || h.title}`;
  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const startsAt = later && startAt ? new Date(startAt).getTime() : Date.now();
      const room = await api<RoomView>('oj/contests', {
        kind,
        title: title.trim(),
        displayName: name.trim(),
        startsAt,
        durationMin: duration,
        shareCode: share,
        ...(source === 'pick'
          ? { problems: picked.map((p) => p.id) }
          : source === 'draw'
            ? { draw: { questions, source: pool } }
            : { replay }),
      });
      location.assign(`/contest/${encodeURIComponent(room.id)}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }
  return (
    <form className="contest-card contest-create" onSubmit={create}>
      <fieldset className="contest-segment">
        <legend>{t('类型', 'Format')}</legend>
        {(['mashup', 'duel'] as const).map((k) => (
          <label key={k}>
            <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />
            <span>{kindLabel(k, t)}</span>
          </label>
        ))}
      </fieldset>
      <label>
        <span>{t('房间名', 'Room name')}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} required />
      </label>
      <label>
        <span>{t('你的比赛昵称', 'Your contest name')}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} required />
      </label>
      <fieldset className="contest-segment">
        <legend>{t('题目', 'Questions')}</legend>
        <label>
          <input type="radio" name="source" checked={source === 'pick'} onChange={() => setSource('pick')} />
          <span>{t('自己选题', 'Pick them')}</span>
        </label>
        <label>
          <input type="radio" name="source" checked={source === 'draw'} onChange={() => setSource('draw')} />
          <span>{t('随机抽题', 'Random draw')}</span>
        </label>
        <label>
          <input type="radio" name="source" checked={source === 'replay'} onChange={() => setSource('replay')} disabled={!replays.length} />
          <span>{t('重打往期力扣周赛', 'Replay a past LeetCode weekly')}</span>
        </label>
      </fieldset>
      {source === 'pick' && (
        <div className="contest-picker">
          <label>
            <span>{t('搜索题号或标题（最多 6 题）', 'Search by number or title (up to 6)')}</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('如 15 或 三数之和', 'e.g. 15 or 3Sum')} />
          </label>
          {!!query.trim() && !!hits.length && (
            <ul className="contest-hits" aria-label={t('搜索结果', 'Results')}>
              {hits.map((h) => (
                <li key={h.id}>
                  <span>{label(h)}</span>
                  <RatingBadge rating={h.rating} english={!zh} />
                  <button
                    type="button"
                    disabled={picked.length >= 6 || picked.some((p) => p.id === h.id)}
                    onClick={() => setPicked([...picked, h])}
                  >
                    {t('加入', 'Add')}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <ol className="contest-picked" aria-label={t('已选题目', 'Chosen questions')}>
            {picked.map((p, i) => (
              <li key={p.id}>
                <span className="contest-q">Q{i + 1}</span>
                <span>{label(p)}</span>
                <button type="button" aria-label={t(`移除 ${label(p)}`, `Remove ${label(p)}`)} onClick={() => setPicked(picked.filter((x) => x.id !== p.id))}>
                  ×
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
      {source === 'draw' && (
        <div className="contest-row">
          <label>
            <span>{t('题数', 'Questions')}</span>
            <select value={questions} onChange={(e) => setQuestions(Number(e.target.value))}>
              {[1, 2, 3, 4].map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t('题源', 'Pool')}</span>
            <select value={pool} onChange={(e) => setPool(e.target.value as typeof pool)}>
              <option value="mixed">{t('OA 真题 + 500 路', 'OA + Line 500')}</option>
              <option value="lc">{t('只要 500 路', 'Line 500 only')}</option>
              <option value="oa">{t('只要 OA 真题', 'OA only')}</option>
            </select>
          </label>
        </div>
      )}
      {source === 'replay' && (
        <label>
          <span>{t('往期周赛（只含本站可判的题）', 'Past weekly (only the problems judgeable here)')}</span>
          <select value={replay} onChange={(e) => setReplay(e.target.value)}>
            {replays.map((r) => (
              <option key={r.code} value={r.code}>
                {contestName(r.code, zh)} · {t(`${r.count} 题`, `${r.count} questions`)}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="contest-row">
        <label>
          <span>{t('时长', 'Length')}</span>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {t(`${d} 分钟`, `${d} min`)}
              </option>
            ))}
          </select>
        </label>
        <label className="contest-inline">
          <input type="checkbox" checked={later} onChange={(e) => setLater(e.target.checked)} />
          <span>{t('定时开赛', 'Start later')}</span>
        </label>
        {later && (
          <label>
            <span>{t('开赛时间（本地）', 'Start (your time)')}</span>
            <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
          </label>
        )}
      </div>
      <ShareCode checked={share} onChange={setShare} t={t} />
      <p className="contest-hidden-note">
        {kind === 'duel'
          ? t('对战在对手加入时开始计时。', 'A duel’s clock starts when your opponent joins.')
          : t(
              '开赛后才加入的人走虚拟参赛、单独排名；想和朋友同场比，就定时开赛。',
              'Anyone joining after the start runs it virtually, ranked separately: to race friends together, schedule the start.',
            )}
      </p>
      <button className="lists-public-cta" type="submit" disabled={busy || (source === 'pick' && !picked.length)}>
        {t('开房间', 'Open the room')}
      </button>
      {error && (
        <p className="contest-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

/**
 * Quick match for a ranked duel: queue under a contest name, poll every 3 seconds while waiting,
 * and go to the room once matched. A queue or duel already running (another tab) is picked up.
 */
export function DuelQueue({ suggested, verified }: { suggested: string; verified: boolean }) {
  const t = useT();
  const now = useNow();
  const [state, setState] = useState<DuelQueueState | null>(null);
  const [error, setError] = useState('');
  const show = useCallback((next: DuelQueueState) => {
    setState(next);
    setError('');
    if (next.state === 'matched') location.assign(`/contest/${encodeURIComponent(next.roomId)}`);
  }, []);
  const poll = useCallback(
    () =>
      api<DuelQueueState>('oj/contests/duel/queue')
        .then(show)
        .catch((e: Error) => setError(e.message)),
    [show],
  );
  useEffect(() => {
    if (verified) void poll();
  }, [verified, poll]);
  const waiting = state?.state === 'waiting';
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(poll, 3000);
    return () => clearInterval(timer);
  }, [waiting, poll]);
  if (!verified)
    return <p className="contest-hidden-note">{t('验证邮箱后可以排位对战。', 'Verify your email to play ranked duels.')}</p>;
  if (state?.state === 'waiting')
    return (
      <div className="contest-queue">
        <p aria-live="polite">
          {t(
            `正在匹配：对战 rating ${state.rating}，当前接受 ±${state.window} 内的对手`,
            `Finding an opponent: duel rating ${state.rating}, now within ±${state.window}`,
          )}
          {now !== null && <span className="contest-queue-wait"> · {formatClock(Math.max(0, now - state.since))}</span>}
        </p>
        <button
          type="button"
          onClick={() =>
            api<DuelQueueState>('oj/contests/duel/leave', {})
              .then(show)
              .catch((e: Error) => setError(e.message))
          }
        >
          {t('取消匹配', 'Cancel')}
        </button>
        {error && (
          <p className="contest-error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  return (
    <>
      <NameForm
        suggested={suggested}
        t={t}
        label={t('快速匹配', 'Quick match')}
        submit={async (displayName) => show(await api<DuelQueueState>('oj/contests/duel/queue', { displayName }))}
      />
      {error && (
        <p className="contest-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
