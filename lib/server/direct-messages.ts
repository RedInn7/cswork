import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import type { Person } from './auth';
import { HttpError, json, limit, requirePerson } from './http';
import { notify } from './notify';
import { HANDLE, requireVerified } from './learner-cloud';
import { readJson } from './my-practice';
import { fileReport, nameOf, reportReason } from './solution-posts';

/**
 * Direct messages (db/community-schema.ts). A conversation starts only between learners who
 * follow each other (the board's referral threads were removed). Either side may block the other, anyone
 * may stop new conversations, and caps hold per sender and per recipient a day. Pages carry an
 * opaque thread key and the other side's public handle or masked name, never account ids. A new
 * message leaves an in-app notification naming the sender, never the text, and sends no mail.
 */
const DAY = 86400000;
const PAGE = 100;
/**
 * A message: like plain() (lib/server/plain-text.ts), but it may run over several lines, indent
 * pasted code with tabs, and join emoji (👩‍💻) or Persian and Indic letters with zero-width (non-)joiners.
 */
export const chatText = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine(
    (s) =>
      !/[\p{C}\u115F\u1160\u3164\uFFA0\u2800]/u.test(s.replace(/[\n\t\u200C\u200D]/g, '')) &&
      /[\p{L}\p{N}\p{S}\p{P}]/u.test(s),
  );
export const NEW_THREADS_PER_DAY = 20;
export const MESSAGES_PER_DAY = 200;
/** New conversations one learner may receive a day. */
export const INBOUND_PER_DAY = 10;
/** Who may start a conversation with you; 'all' and 'follows' both mean mutual follows since referral threads left. */
const OPEN = ['all', 'follows', 'none'] as const;

const threadOf = (a: string, b: string) => [a, b].sort().join('|');
export const threadKey = (thread: string) => createHash('sha256').update(thread).digest('base64url').slice(0, 16);
const otherSide = (thread: string, me: string) => {
  const [a, b] = thread.split('|');
  return a === me ? b : a;
};
const blocks = (from: string, to: string) =>
  !!sqlite().prepare('SELECT 1 FROM dm_blocks WHERE user_id=? AND blocked_id=?').get(from, to);
const openTo = (userId: string) =>
  ((sqlite().prepare('SELECT open FROM dm_settings WHERE user_id=?').pluck().get(userId) as string | undefined) ??
    'all') as (typeof OPEN)[number];

/** Who a new conversation goes to; `post` is '' (old rows opened from a referral thread hold its id). */
function recipient(p: Person, d: { to?: string; post?: string }) {
  const db = sqlite();
  // The board's referral threads are gone, so a conversation opens only between mutual follows.
  if (d.post) throw new HttpError(404, '内推帖不存在或已失效');
  const user = HANDLE.test(d.to ?? '')
    ? (db.prepare('SELECT user_id FROM user_profiles WHERE handle=? AND visible=1').pluck().get(d.to) as
        | string
        | undefined)
    : undefined;
  if (!user) throw new HttpError(404, '主页不存在');
  const follows = db
    .prepare(
      'SELECT COUNT(*) FROM user_follows WHERE (follower_id=? AND followee_id=?) OR (follower_id=? AND followee_id=?)',
    )
    .pluck()
    .get(p.id, user, user, p.id) as number;
  if (user !== p.id && follows < 2) throw new HttpError(403, '互相关注后才能发私信');
  return { user, post: '' };
}

/**
 * One message; `post` is null on a reply, else this opens the thread. One notification per
 * unread stretch, so a burst of lines rings the recipient's bell once.
 */
function send(p: Person, thread: string, to: string, body: string, post: string | null, now: number) {
  const db = sqlite();
  if (blocks(p.id, to) || blocks(to, p.id)) throw new HttpError(403, '对方暂不接收你的私信');
  const sent = db
    .prepare('SELECT COUNT(*) AS n,COUNT(post_id) AS opened FROM direct_messages WHERE from_user=? AND created_at>?')
    .get(p.id, now - DAY) as { n: number; opened: number };
  if (sent.n >= MESSAGES_PER_DAY) throw new HttpError(429, '今天发送的私信已达上限');
  if (post !== null) {
    if (sent.opened >= NEW_THREADS_PER_DAY) throw new HttpError(429, '今天新开的私信会话已达上限');
    const inbound = db
      .prepare('SELECT COUNT(*) FROM direct_messages WHERE to_user=? AND post_id IS NOT NULL AND created_at>?')
      .pluck()
      .get(to, now - DAY) as number;
    if (inbound >= INBOUND_PER_DAY) throw new HttpError(429, '对方今天收到的新私信太多了，请明天再试');
  }
  const ringing = db
    .prepare('SELECT 1 FROM direct_messages WHERE thread=? AND to_user=? AND read_at IS NULL AND hidden=0 LIMIT 1')
    .get(thread, to);
  db.transaction(() => {
    db.prepare(
      'INSERT INTO direct_messages(id,thread,from_user,to_user,body,post_id,hidden,created_at) VALUES(?,?,?,?,?,?,0,?)',
    ).run(randomUUID(), thread, p.id, to, body, post, now);
    if (!ringing)
      notify({
        userId: to,
        kind: 'dm',
        title: '你收到一条新私信',
        body: nameOf(p.id),
        href: `/?view=messages&thread=${threadKey(thread)}`,
        now,
      });
  })();
}

/** The reader's conversations, latest first, with the last message's opening and the unread count. */
export function inbox(me: string) {
  // One max(): SQLite takes body and from_user from the row holding it.
  const rows = sqlite()
    .prepare(
      `SELECT thread,MAX(created_at) AS at,substr(body,1,140) AS last,from_user,
        SUM(to_user=@me AND read_at IS NULL) AS unread
      FROM direct_messages WHERE (from_user=@me OR to_user=@me) AND hidden=0
      GROUP BY thread ORDER BY at DESC LIMIT 100`,
    )
    .all({ me }) as { thread: string; at: number; last: string; from_user: string; unread: number }[];
  return {
    open: openTo(me),
    items: rows.map((r) => ({
      key: threadKey(r.thread),
      name: nameOf(otherSide(r.thread, me)),
      at: r.at,
      last: r.last,
      lastMine: r.from_user === me,
      unread: r.unread,
      blocked: blocks(me, otherSide(r.thread, me)),
    })),
  };
}

/** One conversation, oldest first: the latest PAGE messages. */
export function conversation(me: string, thread: string) {
  const db = sqlite();
  const them = otherSide(thread, me);
  const items = (
    db
      .prepare(
        `SELECT id,body,created_at AS createdAt,from_user=? AS mine FROM direct_messages
        WHERE thread=? AND hidden=0 ORDER BY created_at DESC,rowid DESC LIMIT ${PAGE}`,
      )
      .all(me, thread) as { id: string; body: string; createdAt: number; mine: number }[]
  )
    .reverse()
    .map((m) => ({ ...m, mine: !!m.mine }));
  // Opened from a referral thread: name it, so its author knows which offer this is about.
  const post = db
    .prepare(
      `SELECT sp.id,sp.title FROM direct_messages d JOIN solution_posts sp ON sp.id=d.post_id
      WHERE d.thread=? AND sp.hidden=0 ORDER BY d.created_at LIMIT 1`,
    )
    .get(thread) as { id: string; title: string } | undefined;
  const blocked = blocks(me, them);
  return { key: threadKey(thread), name: nameOf(them), blocked, canSend: !blocked && !blocks(them, me), post: post ?? null, items };
}

/** The reader's thread behind an opaque key, or a 404. */
function threadFor(me: string, key: string) {
  const thread = (
    sqlite()
      .prepare('SELECT DISTINCT thread FROM direct_messages WHERE from_user=? OR to_user=?')
      .pluck()
      .all(me, me) as string[]
  ).find((t) => threadKey(t) === key);
  if (!thread) throw new HttpError(404, '会话不存在');
  return thread;
}

/**
 * /api/oj/dm: GET the inbox; GET <key> a conversation (marking it read); POST {to|post,
 * body} starts one, POST <key> {body} replies, <key>/block {on}, <key>/report {message, reason},
 * POST settings {open}.
 */
export async function handleDirectMessages(request: Request, p: Person | null, path: string[]) {
  requirePerson(p);
  const [key, action, extra] = path;
  if (extra !== undefined) throw new HttpError(404, '接口不存在');
  const db = sqlite();
  const now = Date.now();
  if (request.method === 'GET') {
    await limit(p, 'dm-read', 120);
    if (!key) return json(inbox(p.id));
    if (action) throw new HttpError(404, '接口不存在');
    const thread = threadFor(p.id, key);
    db.prepare('UPDATE direct_messages SET read_at=? WHERE thread=? AND to_user=? AND read_at IS NULL').run(
      now,
      thread,
      p.id,
    );
    return json(conversation(p.id, thread));
  }
  if (request.method !== 'POST') throw new HttpError(404, '接口不存在');
  await limit(p, 'dm-write', 20);
  if (key === 'settings' && !action) {
    const { open } = z.object({ open: z.enum(OPEN) }).strict().parse(await readJson(request, 200));
    db.prepare(
      'INSERT INTO dm_settings(user_id,open,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET open=excluded.open,updated_at=excluded.updated_at',
    ).run(p.id, open, now);
    return json(inbox(p.id));
  }
  if (!key) {
    requireVerified(p);
    const d = z
      .object({ to: z.string().trim().toLowerCase().max(40).optional(), post: z.string().max(40).optional(), body: chatText })
      .strict()
      .refine((v) => !v.to !== !v.post)
      .parse(await readJson(request, 10000));
    const r = recipient(p, d);
    if (r.user === p.id) throw new HttpError(400, '不能给自己发私信');
    const thread = threadOf(p.id, r.user);
    const exists = !!db.prepare('SELECT 1 FROM direct_messages WHERE thread=? LIMIT 1').get(thread);
    const open = openTo(r.user);
    if (!exists && (open === 'none' || (open === 'follows' && r.post))) throw new HttpError(403, '对方暂不接收新的私信');
    send(p, thread, r.user, d.body, exists ? null : r.post, now);
    return json(conversation(p.id, thread), 201);
  }
  const thread = threadFor(p.id, key);
  const them = otherSide(thread, p.id);
  if (!action) {
    requireVerified(p);
    const { body } = z.object({ body: chatText }).strict().parse(await readJson(request, 10000));
    send(p, thread, them, body, null, now);
    return json(conversation(p.id, thread));
  }
  if (action === 'block') {
    const { on } = z.object({ on: z.boolean() }).strict().parse(await readJson(request, 200));
    if (on)
      db.prepare('INSERT INTO dm_blocks(user_id,blocked_id,created_at) VALUES(?,?,?) ON CONFLICT DO NOTHING').run(
        p.id,
        them,
        now,
      );
    else db.prepare('DELETE FROM dm_blocks WHERE user_id=? AND blocked_id=?').run(p.id, them);
    return json(conversation(p.id, thread));
  }
  if (action === 'report') {
    const d = z.object({ message: z.string().max(40), reason: reportReason }).strict().parse(await readJson(request, 500));
    const from = db
      .prepare('SELECT from_user FROM direct_messages WHERE id=? AND thread=? AND hidden=0')
      .pluck()
      .get(d.message, thread) as string | undefined;
    if (!from) throw new HttpError(404, '消息不存在');
    fileReport(p, `dm:${d.message}`, from, d.reason);
    return json({ reported: true });
  }
  throw new HttpError(404, '接口不存在');
}
