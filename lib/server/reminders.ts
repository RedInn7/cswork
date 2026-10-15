import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { roomWeek, weeklyTitle } from '@/lib/contest';
import { englishMessage } from '@/lib/messages-en';
import { dueReviews, type PracticeHistoryItem } from '@/lib/practice-review';
import { practiceStats } from '@/lib/practice-stats';
import type { Person } from './auth';
import { origin, setting } from './env';
import { body, HttpError, json, limit, requirePerson } from './http';
import { mailReady, reminderLines, reminderMail, sendMail, type ReminderDigest } from './mail';
import { notify } from './notify';
import { pushEndpoint, pushReady, pushTo } from './web-push';

/**
 * Learning reminders (db/notify-schema.ts), opt-in on the account page. Once a local day, at the
 * learner's chosen hour, one digest: reviews due, a streak about to break, the daily problem and
 * weeklies or starters they entered that start within a day. It is an in-app notice, a push to
 * each device they turned push on for, and with email on a mail to the verified address. Entrants
 * of a weekly or starter also get a notice and push an hour before it starts. Each notice has a
 * deterministic id: writing it is the claim, so no tick, restart or second worker sends twice.
 * The judge worker runs this every 10 minutes (lib/server/oj-worker.ts), in any TZ.
 * ponytail: tz is the offset when last saved (the card re-saves it when opened elsewhere); a
 * daylight saving change moves the hour until then. Store an IANA zone if that matters.
 */
const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
// Resend's limit is about 2 requests a second, shared with sign-in mails: leave them the other half.
const GAP_MS = 1000;
/** Push devices per learner; subscribing another drops the oldest. */
const DEVICES_MAX = 10;

type Prefs = {
  user_id: string;
  review: number;
  streak: number;
  daily: number;
  contest: number;
  email: number;
  hour: number;
  tz: number;
  locale: string;
  token: string;
};

/** The local date (YYYY-MM-DD) at `at` for a Date#getTimezoneOffset of `tz` minutes. */
const localDate = (at: number, tz: number) => new Date(at - tz * MINUTE).toISOString().slice(0, 10);
/**
 * `at` re-anchored so this process's local time reads the learner's wall clock at `at`: dueReviews
 * and practiceStats count local days, and this makes them the learner's whatever the process TZ.
 */
function wall(at: number, tz: number) {
  const d = new Date(at - tz * MINUTE);
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
    d.getUTCMilliseconds(),
  ).getTime();
}
/** A weekly's or starter's name in the learner's language (contest_rooms keeps the English one). */
const contestTitle = (c: { id: string; title: string; kind: string }, zh: boolean) => {
  const week = roomWeek(c.id);
  return week === null ? c.title : weeklyTitle(week, zh, c.kind);
};
const fresh = (id: string) => !sqlite().prepare('SELECT 1 FROM notifications WHERE id=?').get(id);

/**
 * Today's digest for one learner, or null when it would be empty. Every time is re-anchored to
 * the learner's wall clock, so the counts match their progress page (streak freezes included).
 */
function digestFor(r: Prefs, now: number): ReminderDigest | null {
  const db = sqlite();
  const local = wall(now, r.tz);
  let reviews = 0;
  let streak: ReminderDigest['streak'] = null;
  if (r.review || r.streak) {
    const acs = db
      .prepare("SELECT problem_id,created_at FROM submissions WHERE user_id=? AND mode='judge' AND status='accepted'")
      .all(r.user_id) as { problem_id: string; created_at: number }[];
    if (r.review) {
      const byProblem = new Map<string, number[]>();
      for (const a of acs) {
        const times = byProblem.get(a.problem_id);
        if (times) times.push(wall(a.created_at, r.tz));
        else byProblem.set(a.problem_id, [wall(a.created_at, r.tz)]);
      }
      // dueReviews reads only acAt.
      reviews = dueReviews([...byProblem.values()].map((acAt) => ({ acAt }) as PracticeHistoryItem), local).length;
    }
    if (r.streak) {
      const bought = db
        .prepare("SELECT created_at FROM point_ledger WHERE user_id=? AND reason='freeze' AND created_at>=?")
        .pluck()
        .all(r.user_id, now - 400 * DAY) as number[];
      // The calendar's 183 days (lib/server/api.ts bootstrap activity).
      const stats = practiceStats(
        acs.filter((a) => a.created_at > now - 183 * DAY).map((a) => ({ ...a, created_at: wall(a.created_at, r.tz) })),
        new Date(local).toDateString(),
        true,
        [],
        undefined,
        bought.map((t) => wall(t, r.tz)),
      );
      if (!stats.today && stats.streak >= 2)
        streak = { days: stats.streak, freezes: stats.freezesLeft, breaks: stats.rescue || !stats.freezesLeft };
    }
  }
  const contests = r.contest
    ? (
        db
          .prepare(
            `SELECT c.id,c.title,c.kind,c.starts_at FROM contest_entries e JOIN contest_rooms c ON c.id=e.room_id
            WHERE e.user_id=? AND e.virtual_start IS NULL AND c.kind IN ('weekly','starter') AND c.starts_at>? AND c.starts_at<=?
            ORDER BY c.starts_at`,
          )
          .all(r.user_id, now, now + DAY) as { id: string; title: string; kind: string; starts_at: number }[]
      ).map((c) => ({
        id: c.id,
        title: contestTitle(c, r.locale === 'zh'),
        at: new Date(c.starts_at - r.tz * MINUTE).toISOString().slice(5, 16).replace('T', ' '),
      }))
    : [];
  return reviews || streak || r.daily || contests.length ? { reviews, streak, daily: !!r.daily, contests } : null;
}

/** One tick: contest reminders an hour ahead, then the digests due this hour. Returns notices sent. */
export async function sendLearnerReminders(now = Date.now()) {
  const db = sqlite();
  let sent = 0;
  const starting = db
    .prepare(
      `SELECT e.user_id,c.id,c.title,c.kind,n.locale FROM contest_entries e JOIN contest_rooms c ON c.id=e.room_id
      JOIN notify_prefs n ON n.user_id=e.user_id AND n.contest=1
      WHERE c.kind IN ('weekly','starter') AND e.virtual_start IS NULL AND c.starts_at>? AND c.starts_at<=?`,
    )
    .all(now, now + HOUR) as { user_id: string; id: string; title: string; kind: string; locale: string }[];
  for (const c of starting) {
    const id = `contest:${c.id}:${c.user_id}`;
    const notice = {
      id,
      userId: c.user_id,
      kind: 'contest-start',
      title: '你报名的比赛 1 小时内开始',
      body: contestTitle(c, c.locale === 'zh'),
      href: `/contest/${c.id}`,
      now,
    };
    // notify is false when another worker wrote it in between.
    if (!fresh(id) || !notify(notice)) continue;
    sent++;
    await pushTo(c.user_id, now);
  }
  const due = db
    .prepare(
      `SELECT n.*,u.email AS address,u.email_verified AS verified FROM notify_prefs n JOIN "user" u ON u.id=n.user_id
      WHERE ((? - n.tz*60000)/3600000)%24=n.hour`,
    )
    .all(Math.floor(now)) as (Prefs & { address: string; verified: number })[];
  let mailed = 0;
  for (const r of due) {
    const day = localDate(now, r.tz);
    const id = `rem:${day}:${r.user_id}`;
    if (!fresh(id)) continue;
    const digest = digestFor(r, now);
    if (!digest) continue;
    const zh = r.locale === 'zh';
    const lines = reminderLines(zh, digest);
    const text = lines.map(([line]) => line).join(' · ');
    if (!notify({ id, userId: r.user_id, kind: 'reminder', title: '今日学习提醒', body: text, href: lines[0][1], now })) continue;
    sent++;
    await pushTo(r.user_id, now);
    if (!r.email || !r.verified || !mailReady()) continue;
    if (mailed++) await delay(GAP_MS);
    const unsubscribe = `${origin()}/api/newsletter/unsubscribe?${new URLSearchParams({ token: r.token, list: 'reminders' })}`;
    try {
      // sendMail waits out a 429; any other failure is not retried, the notice and push went out.
      await sendMail({
        to: r.address,
        ...reminderMail(zh, lines, origin(), unsubscribe),
        key: `cswork-reminder-${day}-${r.user_id}`,
        headers: { 'List-Unsubscribe': `<${unsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      });
    } catch (error) {
      console.error('reminder mail', error instanceof Error ? error.message : 'unknown');
    }
  }
  return sent;
}

const prefsSchema = z
  .object({
    review: z.boolean(),
    streak: z.boolean(),
    daily: z.boolean(),
    contest: z.boolean(),
    email: z.boolean(),
    hour: z.number().int().min(0).max(23),
    tz: z.number().int().min(-900).max(900),
    locale: z.enum(['zh', 'en']),
  })
  .strict();

function settings(p: Person) {
  const db = sqlite();
  const row = db
    .prepare('SELECT review,streak,daily,contest,email,hour,tz,locale FROM notify_prefs WHERE user_id=?')
    .get(p.id) as Omit<Prefs, 'user_id' | 'token'> | undefined;
  return {
    prefs: row
      ? {
          review: !!row.review,
          streak: !!row.streak,
          daily: !!row.daily,
          contest: !!row.contest,
          email: !!row.email,
          hour: row.hour,
          tz: row.tz,
          locale: row.locale,
        }
      : null,
    /** The VAPID public key a browser subscribes with; null while push is off. */
    push: pushReady() ? setting('VAPID_PUBLIC_KEY') : null,
    mail: mailReady(),
    verified: p.verified,
    /** The devices with push on: a browser shows push on only when its own endpoint is here. */
    endpoints: db.prepare('SELECT endpoint FROM push_subscriptions WHERE user_id=? ORDER BY created_at').pluck().all(p.id) as string[],
  };
}

/**
 * /api/oj/notify: GET the settings; POST {prefs} (null turns reminders off); POST subscription
 * {endpoint,on} for this device's push; GET pending, what the service worker shows for a push:
 * this learner's newest reminder from the last hour. Each push follows one new notice, so an
 * older one already shown (and maybe dismissed) never pops up again with the next push.
 */
export async function handleNotify(request: Request, p: Person | null, path: string[]) {
  requirePerson(p);
  const [action, extra] = path;
  if (extra !== undefined) throw new HttpError(404, '接口不存在');
  const db = sqlite();
  if (request.method === 'GET') {
    await limit(p, 'notify-read', 120);
    if (!action) return json(settings(p));
    if (action !== 'pending') throw new HttpError(404, '接口不存在');
    const zh = db.prepare('SELECT locale FROM notify_prefs WHERE user_id=?').pluck().get(p.id) === 'zh';
    const items = db
      .prepare(
        `SELECT id,title,body,href FROM notifications WHERE user_id=? AND kind IN ('reminder','contest-start') AND created_at>?
        ORDER BY created_at DESC LIMIT 1`,
      )
      .all(p.id, Date.now() - HOUR) as { id: string; title: string; body: string; href: string }[];
    return json({ items: items.map((n) => ({ ...n, title: zh ? n.title : englishMessage(n.title) })) });
  }
  if (request.method !== 'POST') throw new HttpError(404, '接口不存在');
  await limit(p, 'notify-write', 30);
  const input = await body(request);
  const now = Date.now();
  if (action === 'subscription') {
    const d = z.object({ endpoint: z.string().max(2000), on: z.boolean() }).strict().parse(input);
    if (!d.on) {
      db.prepare('DELETE FROM push_subscriptions WHERE endpoint=? AND user_id=?').run(d.endpoint, p.id);
      return json(settings(p));
    }
    if (!pushReady()) throw new HttpError(409, '推送尚未开通');
    const endpoint = pushEndpoint(d.endpoint);
    if (!endpoint) throw new HttpError(400, '不支持这个推送服务');
    db.transaction(() => {
      // A browser shared between accounts moves to whoever subscribed it last.
      db.prepare(
        `INSERT INTO push_subscriptions(id,user_id,endpoint,created_at) VALUES(?,?,?,?)
        ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,created_at=excluded.created_at`,
      ).run(randomUUID(), p.id, endpoint, now);
      db.prepare(
        `DELETE FROM push_subscriptions WHERE user_id=? AND id NOT IN
        (SELECT id FROM push_subscriptions WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT ${DEVICES_MAX})`,
      ).run(p.id, p.id);
    })();
    return json(settings(p));
  }
  if (action) throw new HttpError(404, '接口不存在');
  const { prefs } = z.object({ prefs: prefsSchema.nullable() }).strict().parse(input);
  if (!prefs)
    // Off: the push addresses have nothing left to deliver, every device's goes too.
    db.transaction(() => {
      db.prepare('DELETE FROM notify_prefs WHERE user_id=?').run(p.id);
      db.prepare('DELETE FROM push_subscriptions WHERE user_id=?').run(p.id);
    })();
  else {
    if (prefs.email && !p.verified) throw new HttpError(403, '请先验证邮箱');
    db.prepare(
      `INSERT INTO notify_prefs(user_id,review,streak,daily,contest,email,hour,tz,locale,token,updated_at)
      VALUES(@user,@review,@streak,@daily,@contest,@email,@hour,@tz,@locale,@token,@now)
      ON CONFLICT(user_id) DO UPDATE SET review=excluded.review,streak=excluded.streak,daily=excluded.daily,
        contest=excluded.contest,email=excluded.email,hour=excluded.hour,tz=excluded.tz,locale=excluded.locale,
        updated_at=excluded.updated_at`,
    ).run({
      ...prefs,
      review: +prefs.review,
      streak: +prefs.streak,
      daily: +prefs.daily,
      contest: +prefs.contest,
      email: +prefs.email,
      user: p.id,
      token: randomBytes(32).toString('base64url'),
      now,
    });
  }
  return json(settings(p));
}
