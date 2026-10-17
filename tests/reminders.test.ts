// Learning reminders (lib/server/reminders.ts) and Web Push (lib/server/web-push.ts), on a fake
// clock: digests go to learners whose local hour it is, once a local day; contest reminders are
// claimed once; push endpoints are allowlisted; mail carries a one-click unsubscribe.
// Neither UTC nor every learner's zone: the digest's local days must not depend on the worker's TZ.
process.env.TZ = 'Asia/Shanghai';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createPublicKey, generateKeyPairSync, verify } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(join(tmpdir(), 'cswork-reminders-'));
process.env.DATABASE_PATH = join(dir, 'app.sqlite');
process.env.APP_URL = 'https://cswork.test';
const jwk = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ format: 'jwk' });
const VAPID_PUBLIC = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x!, 'base64url'), Buffer.from(jwk.y!, 'base64url')]).toString(
  'base64url',
);

const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { handleNewsletterLink } = await import('../lib/server/newsletter');
const { sendLearnerReminders } = await import('../lib/server/reminders');
const { pushEndpoint, vapidJwt } = await import('../lib/server/web-push');
const { reminderLines, sendMail } = await import('../lib/server/mail');
const { englishMessage } = await import('../lib/messages-en');

before(() => migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') }));
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

// Every outgoing request: pushes and Resend mails.
const sent: { url: string; headers: Record<string, string>; body: string | null }[] = [];
let pushStatus = 201;
// What Resend answers next ([status, Retry-After]); then it accepts.
const mailReplies: [number, string?][] = [];
globalThis.fetch = (async (input: string | URL, init: RequestInit = {}) => {
  const url = String(input);
  sent.push({ url, headers: init.headers as Record<string, string>, body: (init.body as string) ?? null });
  if (!url.startsWith('https://api.resend.com/')) return new Response(null, { status: pushStatus });
  const [status, after] = mailReplies.shift() ?? [200];
  return status === 200 ? Response.json({ id: 'mail' }) : new Response(null, { status, headers: after ? { 'Retry-After': after } : {} });
}) as typeof fetch;
const pushes = () => sent.filter((r) => !r.url.startsWith('https://api.resend.com/'));
const mails = () => sent.filter((r) => r.url.startsWith('https://api.resend.com/')).map((r) => JSON.parse(r.body!));

const person = (id: string, verified = true): Person => ({ id, name: id, email: `${id}@example.test`, role: 'student', verified });
function addUser(p: Person) {
  sqlite()
    .prepare('INSERT INTO "user"(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,0,0)')
    .run(p.id, p.name, p.email, +p.verified);
}
async function call(p: Person | null, method: string, path: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/${path}`);
  const request = new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  try {
    const response = await handleOj(request, p, url.pathname.split('/').slice(3));
    // oxlint-disable-next-line typescript/no-explicit-any -- Loose JSON for terse assertions.
    return { status: response.status, data: (await response.json()) as any };
  } catch (error) {
    // oxlint-disable-next-line typescript/no-explicit-any -- Loose JSON for terse assertions.
    return { status: (error as { status?: number }).status ?? 400, data: null as any };
  }
}
const prefs = (o: Record<string, unknown> = {}) => ({
  prefs: { review: true, streak: true, daily: false, contest: true, email: false, hour: 20, tz: 0, locale: 'en', ...o },
});
let ac = 0;
function accept(userId: string, problem: string, at: number) {
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,total,created_at,updated_at)
      VALUES(?,?,?,'python','x','accepted',1,?,?)`,
    )
    .run(`ac-${++ac}`, userId, problem, at, at);
}
const notice = (id: string) =>
  sqlite().prepare('SELECT kind,title,body,href,created_at FROM notifications WHERE id=?').get(id) as
    | { kind: string; title: string; body: string; href: string; created_at: number }
    | undefined;
const withVapid = async <T>(work: () => Promise<T>) => {
  Object.assign(process.env, { VAPID_PUBLIC_KEY: VAPID_PUBLIC, VAPID_PRIVATE_KEY: jwk.d, VAPID_SUBJECT: 'mailto:ops@cswork.test' });
  try {
    return await work();
  } finally {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
  }
};

const HOUR = 3600000;
const DAY = 24 * HOUR;
// 2026-10-15 12:00 UTC: 20:00 in Beijing (getTimezoneOffset -480), noon in London-in-winter (0).
const NOW = Date.UTC(2026, 9, 15, 12);

void test('push endpoints: https on a browser push service only', () => {
  for (const ok of [
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/x',
    'https://web.push.apple.com/QAbc',
    'https://wns2-par02p.notify.windows.com/w/?token=x',
  ])
    assert.equal(pushEndpoint(ok), ok);
  for (const bad of [
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://fcm.googleapis.com:8443/x',
    'https://user@fcm.googleapis.com/x',
    'https://evil.fcm.googleapis.com.attacker.test/x',
    'https://push.apple.com.evil.test/x',
    'https://127.0.0.1/x',
    'https://localhost/x',
    'https://notify.windows.com/x',
    'not a url',
  ])
    assert.equal(pushEndpoint(bad), null, bad);
});

void test('VAPID: an ES256 JWT for the push service origin that the public key verifies', async () => {
  await withVapid(async () => {
    const token = vapidJwt('https://fcm.googleapis.com', NOW);
    const [header, payload, signature] = token.split('.');
    assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url').toString()), { typ: 'JWT', alg: 'ES256' });
    assert.deepEqual(JSON.parse(Buffer.from(payload, 'base64url').toString()), {
      aud: 'https://fcm.googleapis.com',
      exp: NOW / 1000 + 12 * 3600,
      sub: 'mailto:ops@cswork.test',
    });
    const key = createPublicKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', x: jwk.x!, y: jwk.y! } });
    assert.ok(verify('sha256', Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')));
  });
});

void test('settings: opt-in, email needs a verified address, push needs VAPID and an allowed endpoint, 10 devices', async () => {
  const amy = person('r-amy');
  addUser(amy);
  assert.equal((await call(null, 'GET', 'oj/notify')).status, 401);
  assert.deepEqual((await call(amy, 'GET', 'oj/notify')).data, { prefs: null, push: null, mail: false, verified: true, endpoints: [] });
  assert.equal((await call(person('r-new', false), 'POST', 'oj/notify', prefs({ email: true }))).status, 403);
  assert.equal((await call(amy, 'POST', 'oj/notify', prefs({ hour: 24 }))).status, 400);
  assert.equal((await call(amy, 'POST', 'oj/notify', prefs({ extra: 1 }))).status, 400);
  const on = await call(amy, 'POST', 'oj/notify', prefs({ hour: 7, tz: -480, locale: 'zh' }));
  assert.equal(on.data.prefs.hour, 7);
  const row = sqlite().prepare('SELECT * FROM notify_prefs WHERE user_id=?').get(amy.id) as { token: string; tz: number };
  assert.match(row.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(row.tz, -480);
  // Saving again keeps the unsubscribe token.
  await call(amy, 'POST', 'oj/notify', prefs({ hour: 8 }));
  assert.equal((sqlite().prepare('SELECT token FROM notify_prefs WHERE user_id=?').get(amy.id) as { token: string }).token, row.token);

  const subscribe = (p: Person, endpoint: string) => call(p, 'POST', 'oj/notify/subscription', { endpoint, on: true });
  assert.equal((await subscribe(amy, 'https://fcm.googleapis.com/fcm/send/a0')).status, 409, 'push off without VAPID keys');
  await withVapid(async () => {
    assert.equal((await call(amy, 'GET', 'oj/notify')).data.push, VAPID_PUBLIC);
    assert.equal((await subscribe(amy, 'https://169.254.169.254/latest/meta-data')).status, 400);
    assert.equal((await subscribe(amy, 'http://fcm.googleapis.com/fcm/send/a0')).status, 400);
    for (let i = 0; i < 11; i++) assert.equal((await subscribe(amy, `https://fcm.googleapis.com/fcm/send/a${i}`)).status, 200);
    const endpoints = () =>
      sqlite().prepare('SELECT endpoint FROM push_subscriptions WHERE user_id=? ORDER BY endpoint').pluck().all(amy.id) as string[];
    assert.equal(endpoints().length, 10);
    // The eleventh drops the oldest.
    assert.ok(!endpoints().includes('https://fcm.googleapis.com/fcm/send/a0'));
    // A shared browser moves to whoever subscribed it last.
    const bob = person('r-bob');
    await subscribe(bob, 'https://fcm.googleapis.com/fcm/send/a10');
    assert.equal(endpoints().length, 9);
    assert.deepEqual((await call(bob, 'GET', 'oj/notify')).data.endpoints, ['https://fcm.googleapis.com/fcm/send/a10']);
    // Turning a device off removes only the caller's own.
    await call(amy, 'POST', 'oj/notify/subscription', { endpoint: 'https://fcm.googleapis.com/fcm/send/a10', on: false });
    assert.equal((await call(bob, 'GET', 'oj/notify')).data.endpoints.length, 1);
    await call(bob, 'POST', 'oj/notify/subscription', { endpoint: 'https://fcm.googleapis.com/fcm/send/a10', on: false });
    assert.deepEqual((await call(bob, 'GET', 'oj/notify')).data.endpoints, []);
    assert.equal((await call(amy, 'GET', 'oj/notify')).data.endpoints.length, 9);
  });
  // Off deletes the settings and every device's push address.
  const off = (await call(amy, 'POST', 'oj/notify', { prefs: null })).data;
  assert.deepEqual([off.prefs, off.endpoints], [null, []]);
  assert.equal(sqlite().prepare('SELECT COUNT(*) FROM push_subscriptions WHERE user_id=?').pluck().get(amy.id), 0);
});

void test('the digest goes to learners whose local hour it is, once a local day, with reviews and the streak', async () => {
  const cara = person('r-cara'); // Beijing, 20:00.
  const dan = person('r-dan'); // UTC, 20:00: not yet.
  const eve = person('r-eve'); // Beijing, nothing to say.
  for (const p of [cara, dan, eve]) addUser(p);
  await call(cara, 'POST', 'oj/notify', prefs({ tz: -480, locale: 'zh', email: true, daily: true }));
  await call(dan, 'POST', 'oj/notify', prefs({ tz: 0, daily: true }));
  await call(eve, 'POST', 'oj/notify', prefs({ tz: -480 }));
  // Beijing days: an AC on Oct 11, none on the 12th (a streak freeze covers it), ACs on the 13th
  // and 14th, nothing yet on the 15th. Oct 11's problem is due for review on the 14th.
  const bj = (day: number, hour = 10) => Date.UTC(2026, 9, day, hour) - 8 * HOUR;
  accept(cara.id, 'lc-1', bj(11));
  accept(cara.id, 'lc-2', bj(13));
  accept(cara.id, 'lc-3', bj(14, 23)); // 23:00 Beijing is still the 14th there (15:00 UTC).
  // A hint before lc-2's AC brings it back a day later, as on the progress page: due on the 14th too.
  sqlite().prepare("INSERT INTO practice_aids(user_id,problem_id,kind,value,created_at) VALUES(?,'lc-2','hint',0,?)").run(cara.id, bj(13, 9));
  await withVapid(async () => {
    await call(cara, 'POST', 'oj/notify/subscription', { endpoint: 'https://fcm.googleapis.com/fcm/send/cara', on: true });
    Object.assign(process.env, { RESEND_API_KEY: 're_test', MAIL_FROM: 'CSWork <hi@cswork.test>' });
    try {
      sent.length = 0;
      assert.equal(await sendLearnerReminders(NOW), 1);
      const n = notice(`rem:2026-10-15:${cara.id}`)!;
      assert.equal(n.kind, 'reminder');
      assert.equal(n.title, '今日学习提醒');
      assert.equal(n.body, '2 道题到了复习时间 · 已连续打卡 3 天，今天还没有通过的题（本月还剩 1 次断签保护） · 今天的每日一题');
      assert.equal(n.href, '/?view=progress');
      assert.equal(notice(`rem:2026-10-15:${eve.id}`), undefined, 'an empty digest is not sent');
      assert.equal(notice(`rem:2026-10-15:${dan.id}`), undefined, 'noon in London');
      // One payload-free push, VAPID-signed for its service.
      const [push] = pushes();
      assert.equal(pushes().length, 1);
      assert.equal(push.url, 'https://fcm.googleapis.com/fcm/send/cara');
      assert.equal(push.body, null);
      assert.match(push.headers.Authorization, new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${VAPID_PUBLIC}$`));
      // Dropped by the push service once pending would no longer find its notice.
      assert.equal(push.headers.TTL, '3600');
      // One mail with a one-click unsubscribe.
      const [mail] = mails();
      const token = sqlite().prepare('SELECT token FROM notify_prefs WHERE user_id=?').pluck().get(cara.id) as string;
      const unsubscribe = `https://cswork.test/api/newsletter/unsubscribe?token=${token}&list=reminders`;
      assert.deepEqual(mail.to, ['r-cara@example.test']);
      assert.equal(mail.subject, 'CSWork 今日学习提醒');
      assert.ok(mail.text.includes('· 今天的每日一题\n  https://cswork.test/daily'));
      assert.ok(mail.text.includes(unsubscribe));
      assert.equal(mail.headers['List-Unsubscribe'], `<${unsubscribe}>`);
      assert.equal(mail.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
      // The rest of the hour: nothing again.
      sent.length = 0;
      assert.equal(await sendLearnerReminders(NOW + 10 * 60000), 0);
      assert.equal(await sendLearnerReminders(NOW + 50 * 60000), 0);
      assert.equal(sent.length, 0);
      // The service worker reads it back within the hour (the handler's own clock), in the learner's
      // language: only the newest, so a contest notice pushed earlier never pops up again.
      sqlite().prepare('UPDATE notifications SET created_at=? WHERE id=?').run(Date.now(), `rem:2026-10-15:${cara.id}`);
      sqlite()
        .prepare("INSERT INTO notifications(id,user_id,kind,title,body,href,created_at) VALUES('r-earlier',?,'contest-start','比赛','x','/contest/x',?)")
        .run(cara.id, Date.now() - 30 * 60000);
      assert.deepEqual((await call(cara, 'GET', 'oj/notify/pending')).data.items.map((i: { title: string }) => i.title), ['今日学习提醒']);
      // London's 20:00, and Beijing's next day: once each. Dan has only the daily problem.
      assert.equal(await sendLearnerReminders(NOW + 8 * HOUR), 1);
      assert.equal(notice(`rem:2026-10-15:${dan.id}`)!.body, 'Today’s daily problem');
      assert.equal(notice(`rem:2026-10-15:${dan.id}`)!.href, '/daily');
      assert.equal(await sendLearnerReminders(NOW + DAY), 1);
      // Yesterday went without an AC: only one today lets a freeze cover it, as the calendar says.
      assert.ok(notice(`rem:2026-10-16:${cara.id}`)!.body.includes('已连续打卡 3 天，今天还没有通过的题，今天不做就断了'));

      // One-click unsubscribe turns the mail off and nothing else.
      const oneClick = await handleNewsletterLink(
        new Request(unsubscribe, { method: 'POST', body: 'List-Unsubscribe=One-Click' }),
        'unsubscribe',
      );
      assert.equal(oneClick.status, 200);
      const row = sqlite().prepare('SELECT email,daily FROM notify_prefs WHERE user_id=?').get(cara.id);
      assert.deepEqual({ ...(row as object) }, { email: 0, daily: 1 });
      const page = await handleNewsletterLink(new Request(unsubscribe), 'unsubscribe');
      assert.equal(page.headers.get('location'), `https://cswork.test/newsletter/unsubscribe?token=${token}&list=reminders`);
      const form = await handleNewsletterLink(new Request(unsubscribe, { method: 'POST', body: '' }), 'unsubscribe');
      assert.equal(form.headers.get('location'), 'https://cswork.test/newsletter/unsubscribe?list=reminders&done=1');
    } finally {
      delete process.env.RESEND_API_KEY;
      delete process.env.MAIL_FROM;
    }
  });
});

void test('a streak with no freeze left is about to break; a gone push subscription is dropped', async () => {
  const finn = person('r-finn');
  addUser(finn);
  await call(finn, 'POST', 'oj/notify', prefs({ review: false, hour: 12 }));
  // UTC: ACs on Oct 13 and 14, a gap on the 12th... two gaps earlier this month use both free freezes.
  for (const day of [5, 7, 9, 13, 14]) accept(finn.id, 'lc-9', Date.UTC(2026, 9, day, 9));
  accept(finn.id, 'lc-10', Date.UTC(2026, 9, 11, 9));
  await withVapid(async () => {
    await call(finn, 'POST', 'oj/notify/subscription', { endpoint: 'https://web.push.apple.com/finn', on: true });
    pushStatus = 410;
    try {
      assert.equal(await sendLearnerReminders(NOW), 1);
    } finally {
      pushStatus = 201;
    }
  });
  // Oct 6, 8, 10 and 12 are gaps between AC days: the two free freezes cover the 6th and 8th, so
  // the run starts on the 9th... and nothing covers today.
  assert.equal(notice(`rem:2026-10-15:${finn.id}`)!.body, '2-day streak and nothing solved today: solve one today or it ends');
  assert.equal(sqlite().prepare('SELECT COUNT(*) FROM push_subscriptions WHERE user_id=?').pluck().get(finn.id), 0);
});

void test('contest reminders: live entrants of a weekly or starter, an hour ahead, claimed once', async () => {
  const room = (id: string, kind: string, startsAt: number) =>
    sqlite()
      .prepare(
        `INSERT INTO contest_rooms(id,title,kind,problem_ids_json,starts_at,duration_min,visibility,created_at)
        VALUES(?,?,?,'[]',?,90,'public',0)`,
      )
      .run(id, `CSWork ${id}`, kind, startsAt);
  const enter = (roomId: string, userId: string, virtualStart: number | null = null) =>
    sqlite()
      .prepare('INSERT INTO contest_entries(room_id,user_id,display_name,joined_at,virtual_start) VALUES(?,?,?,0,?)')
      .run(roomId, userId, userId, virtualStart);
  const gus = person('r-gus'); // Reminders on.
  const hal = person('r-hal'); // Reminders on, contest reminders off.
  const ivy = person('r-ivy'); // Never opted in.
  const jo = person('r-jo'); // Reminders on, in Chinese.
  for (const p of [gus, hal, ivy, jo]) addUser(p);
  await call(gus, 'POST', 'oj/notify', prefs({ review: false, streak: false, hour: 3 }));
  await call(jo, 'POST', 'oj/notify', prefs({ review: false, streak: false, hour: 3, locale: 'zh' }));
  await call(hal, 'POST', 'oj/notify', prefs({ contest: false, review: false, streak: false, hour: 3 }));
  room('weekly-1', 'weekly', NOW + 40 * 60000);
  room('mashup-1', 'mashup', NOW + 40 * 60000);
  room('starter-1', 'starter', NOW + 3 * HOUR);
  for (const p of [gus, hal, ivy, jo]) enter('weekly-1', p.id);
  enter('mashup-1', gus.id);
  enter('starter-1', gus.id);
  assert.equal(await sendLearnerReminders(NOW), 2);
  // Named as the contest pages name it, in each learner's language (the room keeps the English).
  assert.equal(notice(`contest:weekly-1:${jo.id}`)!.body, 'CSWork 周赛 第 1 期');
  const n = notice(`contest:weekly-1:${gus.id}`)!;
  assert.deepEqual({ ...n, created_at: 0 }, {
    kind: 'contest-start',
    title: '你报名的比赛 1 小时内开始',
    body: 'CSWork Weekly #1',
    href: '/contest/weekly-1',
    created_at: 0,
  });
  assert.equal(notice(`contest:weekly-1:${hal.id}`), undefined);
  assert.equal(notice(`contest:weekly-1:${ivy.id}`), undefined);
  assert.equal(notice(`contest:mashup-1:${gus.id}`), undefined);
  // Claimed: the next ticks leave it alone, read or not.
  sqlite().prepare('UPDATE notifications SET read_at=1 WHERE id=?').run(`contest:weekly-1:${gus.id}`);
  assert.equal(await sendLearnerReminders(NOW + 10 * 60000), 0);
  assert.equal(notice(`contest:weekly-1:${gus.id}`)!.created_at, NOW);
  // The starter, an hour before it; a virtual entrant never.
  enter('starter-1', hal.id, NOW);
  assert.equal(await sendLearnerReminders(NOW + 2 * HOUR + 1), 1);
  assert.ok(notice(`contest:starter-1:${gus.id}`));
  // The next day's digest at Gus's hour names a contest within the day, in his time.
  room('weekly-2', 'weekly', Date.UTC(2026, 9, 17, 1));
  enter('weekly-2', gus.id);
  enter('weekly-2', jo.id);
  assert.equal(await sendLearnerReminders(Date.UTC(2026, 9, 16, 3, 5)), 2);
  assert.equal(notice(`rem:2026-10-16:${gus.id}`)!.body, 'CSWork Weekly #2: starts 10-17 01:00');
  assert.equal(notice(`rem:2026-10-16:${jo.id}`)!.body, 'CSWork 周赛 第 2 期：10-17 01:00 开始');
});

void test('a mail Resend rate-limits is sent again with the same key after Retry-After, within a few seconds', async () => {
  Object.assign(process.env, { RESEND_API_KEY: 're_test', MAIL_FROM: 'CSWork <hi@cswork.test>' });
  const mail = (key: string) => sendMail({ to: 'a@example.test', subject: 's', text: 't', key });
  try {
    sent.length = 0;
    mailReplies.push([429, '1']);
    const start = Date.now();
    await mail('k-1');
    assert.ok(Date.now() - start >= 1000, 'waited out Retry-After');
    assert.deepEqual(sent.map((r) => r.headers['Idempotency-Key']), ['k-1', 'k-1']);
    // Longer than a web request should hang, or not a 429: given up at once.
    sent.length = 0;
    mailReplies.push([429, '60'], [500]);
    await assert.rejects(mail('k-2'), /429/);
    await assert.rejects(mail('k-3'), /500/);
    assert.equal(sent.length, 2);
  } finally {
    mailReplies.length = 0;
    delete process.env.RESEND_API_KEY;
    delete process.env.MAIL_FROM;
  }
});

void test('tracker reminders: an open OA a day and two hours ahead, an interview an hour ahead, once per time', async () => {
  const kai = person('r-kai'); // Beijing, in Chinese, tracker reminders on by default.
  const lee = person('r-lee'); // Tracker reminders off.
  const mo = person('r-mo'); // Never opted in.
  for (const p of [kai, lee, mo]) addUser(p);
  const quiet = { review: false, streak: false, contest: false, hour: 3 };
  // A page cached from before the field existed still saves; it defaults to on.
  assert.equal((await call(kai, 'POST', 'oj/notify', prefs({ ...quiet, tz: -480, locale: 'zh' }))).data.prefs.applications, true);
  assert.equal((await call(lee, 'POST', 'oj/notify', prefs({ ...quiet, applications: false }))).data.prefs.applications, false);
  const card = async (p: Person, body: Record<string, unknown>) => (await call(p, 'POST', 'oj/applications', body)).data.item.id as string;
  const oa = await card(kai, { company: 'Acme', role: 'SWE Intern', stage: 'oa', oaDeadline: NOW + 20 * HOUR });
  // Within 2 hours when first seen: the 2-hour one only, never the 24-hour one after it.
  const late = await card(kai, { company: 'Late', stage: 'applied', oaDeadline: NOW + 90 * 60000 });
  await card(kai, { company: 'Past OA', stage: 'phone', oaDeadline: NOW + 20 * HOUR });
  const interview = await card(kai, { company: 'Beta', stage: 'phone', interviewAt: NOW + 50 * 60000 });
  await card(kai, { company: 'No', stage: 'rejected', interviewAt: NOW + 50 * 60000 });
  const ghosted = await card(kai, { company: 'Silent', stage: 'onsite', interviewAt: NOW + 50 * 60000 });
  sqlite().prepare("UPDATE job_applications SET stage='ghosted' WHERE id=?").run(ghosted);
  for (const p of [lee, mo]) await card(p, { company: 'Acme', stage: 'oa', oaDeadline: NOW + 20 * HOUR, interviewAt: NOW + 50 * 60000 });

  await withVapid(async () => {
    await call(kai, 'POST', 'oj/notify/subscription', { endpoint: 'https://fcm.googleapis.com/fcm/send/kai', on: true });
    sent.length = 0;
    assert.equal(await sendLearnerReminders(NOW), 3);
    assert.equal(pushes().length, 3);
  });
  // Times in the learner's zone: NOW is 20:00 in Beijing.
  assert.deepEqual({ ...notice(`app-oa24:${oa}:${NOW + 20 * HOUR}`)!, created_at: 0 }, {
    kind: 'application',
    title: 'OA 将在 24 小时内截止',
    body: 'Acme · SWE Intern · 10-16 16:00',
    href: '/career/tracker',
    created_at: 0,
  });
  assert.equal(notice(`app-oa2:${late}:${NOW + 90 * 60000}`)!.body, 'Late · 10-15 21:30');
  assert.equal(notice(`app-interview:${interview}:${NOW + 50 * 60000}`)!.title, '面试将在 1 小时内开始');
  const others = sqlite()
    .prepare("SELECT COUNT(*) FROM notifications WHERE kind='application' AND user_id<>?")
    .pluck()
    .get(kai.id);
  assert.equal(others, 0, 'tracker reminders off, or never opted in');
  // Each push shows every notice of the newest tick (the service worker tags them by id), not just one.
  sqlite().prepare("UPDATE notifications SET created_at=? WHERE user_id=? AND kind='application'").run(Date.now(), kai.id);
  const shown = (await call(kai, 'GET', 'oj/notify/pending')).data.items.map((i: { title: string }) => i.title);
  assert.deepEqual(shown.sort(), ['OA 将在 24 小时内截止', 'OA 将在 2 小时内截止', '面试将在 1 小时内开始'].sort());
  assert.equal(englishMessage('面试将在 1 小时内开始'), 'An interview starts within the hour');

  // Claimed: later ticks leave them alone, the 24-hour one included once inside 2 hours for Late.
  assert.equal(await sendLearnerReminders(NOW + 10 * 60000), 0);
  // Moved to a new time: reminded again.
  await call(kai, 'POST', `oj/applications/${oa}`, { oaDeadline: NOW + 22 * HOUR });
  assert.equal(await sendLearnerReminders(NOW + 20 * 60000), 1);
  assert.ok(notice(`app-oa24:${oa}:${NOW + 22 * HOUR}`));
  // Two hours before the new time, then nothing more.
  assert.equal(await sendLearnerReminders(NOW + 20.5 * HOUR), 1);
  assert.equal(notice(`app-oa2:${oa}:${NOW + 22 * HOUR}`)!.title, 'OA 将在 2 小时内截止');
  assert.equal(await sendLearnerReminders(NOW + 21 * HOUR), 0);
  // Deleting a card deletes its reminder notices (company and role) too, nobody else's.
  await call(kai, 'POST', `oj/applications/${oa}/delete`, {});
  assert.equal(notice(`app-oa24:${oa}:${NOW + 22 * HOUR}`), undefined);
  assert.equal(notice(`app-oa2:${oa}:${NOW + 22 * HOUR}`), undefined);
  assert.ok(notice(`app-interview:${interview}:${NOW + 50 * 60000}`));
});

void test("the digest counts tracker cards and contacts to follow up by the end of the learner's day", async () => {
  const kai = person('r-kai');
  const lee = person('r-lee');
  // 03:00 on Oct 17 in Beijing, Kai's hour; Lee's (UTC) comes later.
  const at = Date.UTC(2026, 9, 16, 19);
  const bj = (day: number, hour: number) => Date.UTC(2026, 9, day, hour) - 8 * HOUR;
  const card = async (p: Person, stage: string, nextAt: number) => {
    const id = (await call(p, 'POST', 'oj/applications', { company: 'Follow', stage })).data.item.id as string;
    sqlite().prepare('UPDATE job_applications SET next_at=? WHERE id=?').run(nextAt, id);
  };
  await card(kai, 'applied', bj(17, 0));
  await card(kai, 'onsite', bj(17, 23));
  await card(kai, 'rejected', bj(16, 9)); // Over: not followed up.
  await card(kai, 'applied', bj(18, 0)); // Tomorrow.
  await call(kai, 'POST', 'oj/contacts', { name: 'Sam', nextAt: bj(15, 0) });
  await call(kai, 'POST', 'oj/contacts', { name: 'Kim' });
  await card(lee, 'applied', Date.UTC(2026, 9, 16));
  assert.equal(await sendLearnerReminders(at), 1);
  assert.deepEqual([notice(`rem:2026-10-17:${kai.id}`)!.body, notice(`rem:2026-10-17:${kai.id}`)!.href], ['3 项求职跟进到期了', '/career/tracker']);
  await sendLearnerReminders(Date.UTC(2026, 9, 17, 3));
  assert.equal(notice(`rem:2026-10-17:${lee.id}`), undefined, 'tracker reminders off');
  // Only contacts due: the line opens the contacts page.
  assert.deepEqual(reminderLines(false, { reviews: 0, streak: null, daily: false, contests: [], followUps: { applications: 0, contacts: 1 } }), [
    ['1 job-search follow-up is due', '/career/contacts'],
  ]);
});

void test("the digest's reviews follow the learner's daily cap and break (pref:review)", async () => {
  const gil = person('r-gil'); // Two reviews due, at most one a day.
  const una = person('r-una'); // The same two, on a break.
  for (const p of [gil, una]) {
    addUser(p);
    await call(p, 'POST', 'oj/notify', prefs({ hour: 12, streak: false }));
    // Solved Oct 10 (UTC): due on the 13th, overdue on the 15th.
    accept(p.id, 'lc-1', Date.UTC(2026, 9, 10, 9));
    accept(p.id, 'lc-2', Date.UTC(2026, 9, 10, 10));
  }
  const pref = (p: Person, body: unknown) =>
    sqlite()
      .prepare("INSERT INTO user_notes(user_id,target,body,updated_at) VALUES(?,'pref:review',?,0)")
      .run(p.id, JSON.stringify(body));
  pref(gil, { dailyCap: 1 });
  pref(una, { dailyCap: 1, pausedFrom: '2026-10-14', pausedDays: 3 });
  await sendLearnerReminders(NOW);
  assert.equal(notice(`rem:2026-10-15:${gil.id}`)!.body, '1 problem is due for review');
  assert.equal(notice(`rem:2026-10-15:${una.id}`), undefined, 'nothing due on a break');
  // A malformed note reads as no settings: both reviews, the day after.
  sqlite().prepare("UPDATE user_notes SET body='{oops' WHERE user_id=? AND target='pref:review'").run(gil.id);
  await sendLearnerReminders(NOW + DAY);
  assert.equal(notice(`rem:2026-10-16:${gil.id}`)!.body, '2 problems are due for review');
});
