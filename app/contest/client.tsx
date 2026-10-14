'use client';
import { useCallback, useEffect, useState, useSyncExternalStore, type FormEvent } from 'react';
import { CONTEST_KINDS, RATE_GRACE } from '@/lib/contest';
import { contestName } from '@/lib/lc-rating';
import { formatClock } from '@/lib/mock-oa';
import { useLocale, useT } from '@/lib/i18n';
import { api } from '@/lib/types';
import type { RoomView } from '@/lib/server/contests';
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

const kindLabel = (kind: RoomView['kind'], t: T) => t(...CONTEST_KINDS[kind]);
const PHASE: Record<RoomView['phase'], [string, string]> = {
  upcoming: ['未开赛', 'Upcoming'],
  running: ['进行中', 'Live'],
  ended: ['已结束', 'Finished'],
};

function NameForm({
  suggested,
  submit,
  label,
  t,
}: {
  suggested: string;
  submit: (name: string) => Promise<void>;
  label: string;
  t: T;
}) {
  const [name, setName] = useState(suggested);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function go(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await submit(name.trim());
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
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} required autoComplete="nickname" />
      </label>
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

const problemHref = (id: string, room: string | null) =>
  `/?${new URLSearchParams(room ? { view: 'problem', problem: id, room } : { view: 'problem', problem: id, tab: 'solutions' })}`;

type Row = NonNullable<RoomView['standings']>['live'][number];

/** One standings table: rank, name, solved, time, then a cell per question. */
function Board({
  rows,
  count,
  caption,
  rated,
  t,
}: {
  rows: Row[];
  count: number;
  caption: string;
  rated: boolean;
  t: T;
}) {
  const qs = Array.from({ length: count }, (_, i) => `Q${i + 1}`);
  return (
    <div className="contest-board-wrap" role="region" aria-label={caption} tabIndex={0}>
      <table className="contest-board">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
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

/**
 * /contest/<id>: the room, polled every 10 seconds while anything can still change, and once
 * more as soon as the start, the end or the reader's own virtual run is reached.
 */
export function RoomLive({ initial, fallbackStart }: { initial: RoomView; fallbackStart: string }) {
  const t = useT();
  const zh = useLocale() === 'zh';
  const [view, setView] = useState(initial);
  const [skew, setSkew] = useState(0);
  const [error, setError] = useState('');
  const id = view.id;
  const refresh = useCallback(async () => {
    const sent = Date.now();
    const next = await api<RoomView>(`oj/contests/${encodeURIComponent(id)}`);
    setView(next);
    setSkew(next.now - (sent + Date.now()) / 2);
    setError('');
  }, [id]);
  const myEnd = view.me?.end ?? 0;
  const active =
    view.phase !== 'ended' ||
    view.now < myEnd + 60000 ||
    (view.kind === 'weekly' && !view.rated && view.now < view.endsAt + RATE_GRACE + 600000);
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      if (document.visibilityState === 'visible')
        refresh().catch((e: Error) => setError(e.message));
    };
    const timer = setInterval(tick, 10000);
    document.addEventListener('visibilitychange', tick);
    // The moment the board changes phase (start, end, the reader's own end), not 10 s later.
    const next = [view.startsAt, view.endsAt, myEnd].filter((at) => at > view.now).sort((a, b) => a - b)[0];
    const edge = next ? setTimeout(tick, Math.min(2 ** 31 - 1, next - view.now + 1000)) : undefined;
    return () => {
      clearInterval(timer);
      clearTimeout(edge);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [active, refresh, view.startsAt, view.endsAt, view.now, myEnd]);

  const mine = view.me && view.now >= view.me.start && view.now < view.me.end;
  const title = view.week ? (zh ? `CSWork 周赛 第 ${view.week} 期` : `CSWork Weekly #${view.week}`) : view.title;
  const clock =
    view.phase === 'upcoming'
      ? { to: view.startsAt, label: t('距开赛', 'Starts in') }
      : mine && view.me!.virtual
        ? { to: view.me!.end, label: t('虚拟赛剩余', 'Your virtual run ends in') }
        : view.phase === 'running'
          ? { to: view.endsAt, label: t('距结束', 'Ends in') }
          : null;
  const join = async (displayName: string) => {
    setView(await api<RoomView>(`oj/contests/${encodeURIComponent(id)}/join`, { displayName }));
  };
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
            t={t}
            label={
              view.phase === 'ended'
                ? t(`虚拟参赛（从现在起 ${view.durationMin} 分钟）`, `Run it virtually (${view.durationMin} min from now)`)
                : t('报名参赛', 'Enter the contest')
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
        <p className="contest-winner" role="status">
          {view.winner
            ? t(`${view.winner} 率先通过全部题目，赢下对战`, `${view.winner} solved everything first and wins the duel`)
            : t('先通过全部题目的一方获胜；都没做完则按计分板。', 'First to solve every question wins; otherwise the scoreboard decides.')}
        </p>
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
          {view.phase === 'upcoming'
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
              {view.kind === 'weekly' && view.phase === 'ended' && !view.rated
                ? t('结束 15 分钟后结算 rating', 'Ratings settle 15 minutes after the end')
                : ''}
            </small>
          </h2>
          {view.standings.live.length ? (
            <Board rows={view.standings.live} count={view.problemCount} caption={t('实时参赛', 'Live')} rated={view.rated} t={t} />
          ) : (
            <p className="contest-hidden-note">{t('还没有实时参赛的人。', 'Nobody raced this live.')}</p>
          )}
          {view.standings.virtual.length > 0 && (
            <Board rows={view.standings.virtual} count={view.problemCount} caption={t('虚拟参赛（各自计时，不计 rating）', 'Virtual (own clocks, unrated)')} rated={false} t={t} />
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
              '开赛后结束前报名照常计时；结束后加入是虚拟参赛，从加入时起计时，单独排名。',
              'Entering during the contest counts from its start; joining after the end is a virtual run on your own clock, ranked separately.',
            )}
          </li>
          {view.kind === 'weekly' && (
            <li>
              {t(
                '周赛结束后按 Elo 结算 rating：有提交的实时参赛者参与，初始 1500，场次越多波动越小。',
                'Weeklies are rated Elo-style once they end: live entrants with a submission count, everyone starts at 1500, and ratings settle as you race more.',
              )}
            </li>
          )}
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
    setError('');
    setPreview(null);
    try {
      setPreview(await api<Preview>(`oj/contests/preview?${new URLSearchParams({ code: value })}`));
    } catch (e) {
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
              submit={async (displayName) => {
                const room = await api<RoomView>('oj/contests/join', { code: code.trim(), displayName });
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits([]);
      return;
    }
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
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} required autoComplete="nickname" />
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
          {!!hits.length && (
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
