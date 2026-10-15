import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { TEMPLATES } from '@/lib/mock-interview';
import {
  COMMON_FOCUS, FOCUS_MAX, INSTANT_MINUTES, LEAD_HOURS, LEVELS, SLOTS_MAX, WINDOW_HOURS, localSlot, meetingUrl,
} from '@/lib/mock-peer';
import { STOP_NAMES } from '@/lib/route-stops';
import type { Person } from './auth';
import { HttpError, json, limit, requirePerson } from './http';
import { reportCompanies } from './learner-cloud';
import { readJson } from './my-practice';
import { plain } from './study-groups';

/**
 * Peer mock interviews (db/mock-peer-schema.ts): a learner offers UTC hour slots for one
 * template and level; among open requests of the same template and level that share a future
 * slot, the one with the most target companies (×2) and topics in common becomes the partner,
 * the oldest first on a tie. An instant request ("practice now") pairs only with another filed
 * in the last INSTANT_MINUTES, for the hour under way, and lapses after that (lib/server/
 * peer-reminders.ts closes it). Each pair runs two rounds of the template, each side the
 * candidate once, on the mock interview's candidate/interviewer links. Partners see only the
 * name typed for matching. Two no-show reports from different partners in 90 days pause matching;
 * a report the reported side answered with its own does not count. Cancelling a matched session
 * puts the partner's request back in the queue, and three cancels in a week pause the canceller.
 */
const HOUR = 3600000;
const DAY = 24 * HOUR;
/** Scheduled sessions still ahead, per learner. */
export const UPCOMING_MAX = 3;
export const NO_SHOW_LIMIT = 2;
const NO_SHOW_WINDOW = 90 * DAY;
/** No-shows can be reported from 10 minutes after the start until a week later. */
const REPORT_FROM = 10 * 60000;
const REPORT_UNTIL = 7 * DAY;
export const CANCEL_LIMIT = 3;
const CANCEL_WINDOW = 7 * DAY;

type RequestRow = {
  id: string;
  user_id: string;
  display_name: string;
  kind: string;
  level: string;
  slots_json: string;
  tz: number;
  locale: string;
  status: 'open' | 'matched' | 'cancelled';
  pair_id: string | null;
  remind: number;
  focus_json: string;
  instant: number;
  created_at: number;
};
type Focus = { companies: string[]; topics: string[] };
type PairRow = {
  id: string;
  kind: string;
  level: string;
  slot: number;
  seed: string;
  a_user: string;
  a_name: string;
  b_user: string;
  b_name: string;
  meet_url: string;
  status: 'scheduled' | 'cancelled';
  a_no_show_at: number | null;
  b_no_show_at: number | null;
  created_at: number;
};

const INSTANT_MS = INSTANT_MINUTES * 60000;
const hourNow = (now: number) => Math.floor(now / HOUR);
/** Slots still bookable at `now`. */
const open = (slots: readonly number[], now: number) => slots.filter((s) => s >= hourNow(now) + LEAD_HOURS);
/** An open request that can still match: an instant one for INSTANT_MINUTES, else while it has hours ahead. */
const live = (r: Pick<RequestRow, 'slots_json' | 'instant' | 'created_at'>, now: number) =>
  r.instant ? r.created_at > now - INSTANT_MS : open(JSON.parse(r.slots_json) as number[], now).length > 0;
/** What two requests' focus has in common, in the first one's order. */
function commonFocus(mine: Focus, json: string): Focus {
  const theirs = JSON.parse(json) as Partial<Focus>;
  return {
    companies: mine.companies.filter((c) => theirs.companies?.includes(c)),
    topics: mine.topics.filter((t) => theirs.topics?.includes(t)),
  };
}
const affinity = (f: Focus) => f.companies.length * 2 + f.topics.length;

/**
 * Distinct partners who reported `user` missing in the last 90 days, leaving out sessions where
 * `user` reported them too: two throwaway accounts cannot pause someone who was there and said so.
 */
export function noShows(user: string, now = Date.now()) {
  return (
    sqlite()
      .prepare(
        `SELECT COUNT(DISTINCT CASE WHEN a_user=? THEN b_user ELSE a_user END) AS n FROM mock_match_pairs
        WHERE (a_user=? AND a_no_show_at>? AND b_no_show_at IS NULL) OR (b_user=? AND b_no_show_at>? AND a_no_show_at IS NULL)`,
      )
      .get(user, user, now - NO_SHOW_WINDOW, user, now - NO_SHOW_WINDOW) as { n: number }
  ).n;
}
/** Matched sessions `user` cancelled in the last week (their request is cancelled with its pair). */
export function cancels(user: string, now = Date.now()) {
  return sqlite()
    .prepare(`SELECT COUNT(*) FROM mock_match_requests WHERE user_id=? AND status='cancelled' AND pair_id IS NOT NULL AND updated_at>?`)
    .pluck()
    .get(user, now - CANCEL_WINDOW) as number;
}
/** Hours with a scheduled session for `user`. */
function busy(user: string, now: number) {
  return new Set(
    sqlite()
      .prepare(`SELECT slot FROM mock_match_pairs WHERE status='scheduled' AND (a_user=? OR b_user=?) AND slot>=?`)
      .pluck()
      .all(user, user, hourNow(now)) as number[],
  );
}

const templateName = (kind: string, zh: boolean) => TEMPLATES.find((t) => t.id === kind)?.name[zh ? 0 : 1] ?? kind;

/** Titles are fixed text (translated when shown); the body is written in the learner's language. */
function notify(user: string, title: string, body: string, pair: string, now: number) {
  sqlite()
    .prepare('INSERT INTO notifications(id,user_id,title,body,href,created_at) VALUES(?,?,?,?,?,?)')
    .run(randomBytes(16).toString('hex'), user, title, body, `/?view=mock-peer&pair=${pair}`, now);
}
const sideOf = (req: Pick<RequestRow, 'user_id' | 'tz' | 'locale'>) => ({ user: req.user_id, tz: req.tz, zh: req.locale === 'zh' });
/** " · In common: Google, Graphs" for a match notice, or nothing. */
function focusText(f: Focus | undefined, zh: boolean) {
  if (!f || !affinity(f)) return '';
  const items = [
    ...f.companies.map((slug) => reportCompanies().find((c) => c.slug === slug)?.name ?? slug),
    ...f.topics.map((t) => STOP_NAMES[t]?.[zh ? 0 : 1] ?? t),
  ];
  return ` · ${COMMON_FOCUS[zh ? 0 : 1]}: ${items.join(zh ? '、' : ', ')}`;
}
function tell(
  to: { user: string; tz: number; zh: boolean },
  title: string,
  pair: Pick<PairRow, 'id' | 'kind' | 'slot'>,
  partner: string,
  now: number,
  common?: Focus,
) {
  notify(
    to.user,
    title,
    `${templateName(pair.kind, to.zh)} · ${localSlot(pair.slot, to.tz)} · ${to.zh ? '对方' : 'Partner'}: ${partner}${focusText(common, to.zh)}`,
    pair.id,
    now,
  );
}
/** The language and zone each side of a pair asked in. */
function sides(pair: PairRow) {
  const rows = sqlite()
    .prepare('SELECT user_id,tz,locale FROM mock_match_requests WHERE pair_id=?')
    .all(pair.id) as Pick<RequestRow, 'user_id' | 'tz' | 'locale'>[];
  const of = (user: string) => sideOf(rows.find((r) => r.user_id === user) ?? { user_id: user, tz: 0, locale: 'en' });
  return { a: of(pair.a_user), b: of(pair.b_user) };
}

/**
 * Files the request and, in the same transaction, pairs it with the open request of the same
 * template and level that shares a free future slot (the earliest shared one), most focus in
 * common first, then the oldest. An instant request takes the hour under way instead.
 */
export function requestMatch(
  p: Person,
  input: {
    displayName: string;
    kind: string;
    level: string;
    slots: number[];
    tz: number;
    remind?: boolean;
    instant?: boolean;
    focus?: Focus;
  },
  locale: 'zh' | 'en',
  now = Date.now(),
) {
  const instant = !!input.instant,
    focus = input.focus ?? { companies: [], topics: [] };
  const db = sqlite();
  return db.transaction(() => {
    if (noShows(p.id, now) >= NO_SHOW_LIMIT)
      throw new HttpError(403, '你被报告爽约两次，匹配已暂停 90 天');
    if (cancels(p.id, now) >= CANCEL_LIMIT) throw new HttpError(403, '一周内取消了 3 场已匹配的面试，暂时不能匹配');
    const waiting = db
      .prepare(`SELECT slots_json,instant,created_at FROM mock_match_requests WHERE user_id=? AND status='open'`)
      .get(p.id) as Pick<RequestRow, 'slots_json' | 'instant' | 'created_at'> | undefined;
    if (waiting && live(waiting, now)) throw new HttpError(409, '你已经有一个在等待匹配的请求');
    // A request whose hours have all passed (or an instant one that lapsed) gives way to the new one.
    db.prepare(`UPDATE mock_match_requests SET status='cancelled',updated_at=? WHERE user_id=? AND status='open'`).run(now, p.id);
    const mine = busy(p.id, now);
    if (mine.size >= UPCOMING_MAX) throw new HttpError(409, '已经约了 3 场，先完成再约');
    // Practice now bypasses LEAD_HOURS: the hour under way, if it is free.
    const slots = instant
      ? [hourNow(now)].filter((s) => !mine.has(s))
      : open([...new Set(input.slots)], now)
          .filter((s) => s <= hourNow(now) + WINDOW_HOURS && !mine.has(s))
          .sort((x, y) => x - y);
    if (!slots.length)
      throw instant
        ? new HttpError(409, '这个小时你已经约了一场模拟面试')
        : new HttpError(400, '请至少选一个未来 7 天内的时段');
    const id = randomBytes(9).toString('base64url');
    db.prepare(
      `INSERT INTO mock_match_requests(id,user_id,display_name,kind,level,slots_json,tz,locale,status,remind,focus_json,instant,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,'open',?,?,?,?,?)`,
    ).run(
      id, p.id, input.displayName, input.kind, input.level, JSON.stringify(slots), input.tz, locale,
      +(input.remind ?? true), JSON.stringify(focus), +instant, now, now,
    );
    const candidates = (
      db
        .prepare(
          // Slots lie within a week of filing, so older open requests can no longer match.
          `SELECT * FROM mock_match_requests WHERE status='open' AND kind=? AND level=? AND user_id<>? AND instant=? AND created_at>?
          ORDER BY created_at,id`,
        )
        .all(input.kind, input.level, p.id, +instant, now - (instant ? INSTANT_MS : 8 * DAY)) as RequestRow[]
    )
      .map((other) => ({ other, common: commonFocus(focus, other.focus_json) }))
      // Stable: the oldest first among equals.
      .sort((x, y) => affinity(y.common) - affinity(x.common));
    for (const { other, common } of candidates) {
      if (noShows(other.user_id, now) >= NO_SHOW_LIMIT) continue;
      const theirs = busy(other.user_id, now);
      const shared = instant
        ? slots.filter((s) => !theirs.has(s))
        : open(JSON.parse(other.slots_json) as number[], now).filter((s) => slots.includes(s) && !theirs.has(s));
      if (!shared.length) continue;
      const pair: PairRow = {
        id: randomBytes(9).toString('base64url'),
        kind: input.kind,
        level: input.level,
        slot: Math.min(...shared),
        // Two 8-character draws: each round its own set, so neither side has seen their questions.
        seed: randomBytes(8).toString('hex'),
        a_user: other.user_id,
        a_name: other.display_name,
        b_user: p.id,
        b_name: input.displayName,
        meet_url: '',
        status: 'scheduled',
        a_no_show_at: null,
        b_no_show_at: null,
        created_at: now,
      };
      db.prepare(
        `INSERT INTO mock_match_pairs(id,kind,level,slot,seed,a_user,a_name,b_user,b_name,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(pair.id, pair.kind, pair.level, pair.slot, pair.seed, pair.a_user, pair.a_name, pair.b_user, pair.b_name, now, now);
      db.prepare(`UPDATE mock_match_requests SET status='matched',pair_id=?,updated_at=? WHERE id IN (?,?)`).run(
        pair.id,
        now,
        other.id,
        id,
      );
      tell(sideOf(other), '同伴模拟面试已匹配', pair, pair.b_name, now, common);
      tell({ user: p.id, tz: input.tz, zh: locale === 'zh' }, '同伴模拟面试已匹配', pair, pair.a_name, now, common);
      return pair.id;
    }
    return null;
  })();
}

/** A pair as one side sees it: the partner's name, and links to this side's own two roles. */
function view(pair: PairRow, user: string, now: number) {
  const me = pair.a_user === user ? 'a' : 'b';
  // An instant pair starts when it matched, inside its hour.
  const start = Math.max(pair.slot * HOUR, pair.created_at);
  const partnerMissing = me === 'a' ? pair.b_no_show_at : pair.a_no_show_at;
  return {
    id: pair.id,
    kind: pair.kind,
    level: pair.level,
    slot: pair.slot,
    start,
    partner: me === 'a' ? pair.b_name : pair.a_name,
    meetUrl: pair.meet_url,
    status: pair.status,
    // Round one: a is the candidate; round two swaps. Each round draws its own set.
    rounds: [
      { set: pair.seed.slice(0, 8), as: me === 'a' ? 'candidate' : 'interviewer' },
      { set: pair.seed.slice(8, 16), as: me === 'a' ? 'interviewer' : 'candidate' },
    ] as const,
    reported: partnerMissing !== null,
    reportedMe: (me === 'a' ? pair.a_no_show_at : pair.b_no_show_at) !== null,
    canReport:
      pair.status === 'scheduled' && partnerMissing === null && now >= start + REPORT_FROM && now <= start + REPORT_UNTIL,
    canCancel: pair.status === 'scheduled' && now < start,
  };
}
export type PeerPair = ReturnType<typeof view>;

/** The reader's open request, sessions from the last 30 days on, and whether matching is paused. */
export function peerState(user: string, now = Date.now()) {
  const db = sqlite();
  const request = db
    .prepare(`SELECT * FROM mock_match_requests WHERE user_id=? AND status='open'`)
    .get(user) as RequestRow | undefined;
  const pairs = db
    .prepare(
      `SELECT * FROM mock_match_pairs WHERE (a_user=? OR b_user=?) AND slot>=? ORDER BY slot DESC,id LIMIT 30`,
    )
    .all(user, user, hourNow(now) - 30 * 24) as PairRow[];
  const slots = request ? (JSON.parse(request.slots_json) as number[]) : [];
  return {
    request: request
      ? {
          id: request.id,
          displayName: request.display_name,
          kind: request.kind,
          level: request.level,
          slots,
          instant: !!request.instant,
          remind: !!request.remind,
          // Every offered hour has passed (or an instant request's minutes): nobody can match it any more.
          expired: !live(request, now),
          createdAt: request.created_at,
        }
      : null,
    pairs: pairs.map((pair) => view(pair, user, now)),
    paused: noShows(user, now) >= NO_SHOW_LIMIT,
  };
}

function mine(id: string, user: string) {
  const pair = /^[A-Za-z0-9_-]{12}$/.test(id)
    ? (sqlite().prepare('SELECT * FROM mock_match_pairs WHERE id=?').get(id) as PairRow | undefined)
    : undefined;
  if (!pair || (pair.a_user !== user && pair.b_user !== user)) throw new HttpError(404, '这场模拟面试不存在');
  return pair;
}

const requestInput = z
  .object({
    displayName: plain(24),
    kind: z.string().refine((k) => TEMPLATES.some((t) => t.id === k)),
    level: z.enum(LEVELS),
    // Empty for an instant request; a scheduled one without a future hour is refused in requestMatch.
    slots: z.array(z.number().int().nonnegative()).max(SLOTS_MAX).default([]),
    tz: z.number().int().min(-840).max(840),
    remind: z.boolean().default(true),
    instant: z.boolean().default(false),
    focus: z
      .object({
        companies: z
          .array(z.string().max(80))
          .max(FOCUS_MAX)
          .default([])
          .refine((list) => !list.length || list.every((c) => reportCompanies().some((r) => r.slug === c))),
        topics: z
          .array(z.string().refine((t) => Object.hasOwn(STOP_NAMES, t)))
          .max(FOCUS_MAX)
          .default([]),
      })
      .strict()
      .transform((f) => ({ companies: [...new Set(f.companies)], topics: [...new Set(f.topics)] }))
      .default({ companies: [], topics: [] }),
  })
  .strict();

/** /api/oj/peer/…: everything needs a verified account and is rate limited per learner. */
export async function handleMockPeer(request: Request, p: Person | null, path: string[]) {
  requirePerson(p);
  const [id, action, extra] = path;
  if (extra !== undefined) throw new HttpError(404, '接口不存在');
  const now = Date.now();
  if (request.method === 'GET') {
    if (id) throw new HttpError(404, '接口不存在');
    await limit(p, 'peer-read', 120);
    return json(peerState(p.id, now));
  }
  if (request.method !== 'POST') throw new HttpError(404, '接口不存在');
  if (!p.verified && p.role !== 'teacher') throw new HttpError(403, '请先验证邮箱');
  await limit(p, 'peer-write', 20);
  const db = sqlite();
  if (!id) {
    // Each request notifies two people: a tight budget keeps it from becoming a spam channel.
    await limit(p, 'peer-request', 5, 3600);
    await limit(p, 'peer-request-day', 12, 86400);
    const d = requestInput.parse(await readJson(request, 4000));
    requestMatch(p, d, request.headers.get('x-locale') === 'zh' ? 'zh' : 'en', now);
    return json(peerState(p.id, now), 201);
  }
  if (id === 'cancel' && !action) {
    db.prepare(`UPDATE mock_match_requests SET status='cancelled',updated_at=? WHERE user_id=? AND status='open'`).run(
      now,
      p.id,
    );
    return json(peerState(p.id, now));
  }
  const pair = mine(id, p.id);
  const me = pair.a_user === p.id ? 'a' : 'b';
  const { canReport, canCancel } = view(pair, p.id, now);
  const { a, b } = sides(pair);
  const partner = me === 'a' ? b : a;
  const myName = me === 'a' ? pair.a_name : pair.b_name;
  if (action === 'link') {
    if (pair.status !== 'scheduled' || now > pair.slot * HOUR + DAY) throw new HttpError(409, '这场模拟面试已结束或已取消');
    const d = z
      .object({ url: z.string().trim().max(500).refine((u) => u === '' || meetingUrl(u)) })
      .strict()
      .parse(await readJson(request, 1000));
    db.prepare('UPDATE mock_match_pairs SET meet_url=?,updated_at=? WHERE id=?').run(d.url, now, pair.id);
    return json(peerState(p.id, now));
  }
  if (action === 'cancel') {
    if (!canCancel) throw new HttpError(409, '这场模拟面试已开始或已取消');
    db.transaction(() => {
      db.prepare(`UPDATE mock_match_pairs SET status='cancelled',updated_at=? WHERE id=? AND status='scheduled'`).run(now, pair.id);
      // Counts against the canceller (cancels()), never the partner.
      db.prepare(`UPDATE mock_match_requests SET status='cancelled',updated_at=? WHERE pair_id=? AND user_id=?`).run(now, pair.id, p.id);
      // The partner's request goes back to its old place in the queue while it has hours ahead and
      // they have not asked again since. ponytail: it matches the next request filed, not one already waiting.
      const theirs = db
        .prepare(`SELECT id,slots_json FROM mock_match_requests WHERE pair_id=? AND user_id=? AND status='matched'`)
        .get(pair.id, partner.user) as Pick<RequestRow, 'id' | 'slots_json'> | undefined;
      const waiting = db.prepare(`SELECT 1 FROM mock_match_requests WHERE user_id=? AND status='open'`).get(partner.user);
      if (theirs && !waiting && open(JSON.parse(theirs.slots_json) as number[], now).length)
        db.prepare(`UPDATE mock_match_requests SET status='open',pair_id=NULL,updated_at=? WHERE id=?`).run(now, theirs.id);
    })();
    tell(partner, '同伴模拟面试已取消', pair, myName, now);
    return json(peerState(p.id, now));
  }
  if (action === 'no-show') {
    if (!canReport) throw new HttpError(409, '现在不能报告爽约');
    db.prepare(`UPDATE mock_match_pairs SET ${me === 'a' ? 'b' : 'a'}_no_show_at=?,updated_at=? WHERE id=?`).run(
      now,
      now,
      pair.id,
    );
    tell(partner, '对方报告你没有出席模拟面试', pair, myName, now);
    return json(peerState(p.id, now));
  }
  throw new HttpError(404, '接口不存在');
}
