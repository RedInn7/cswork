import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-mock-peer-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { cancels, noShows, requestMatch } = await import('../lib/server/mock-peer');
const { sendPeerReminders } = await import('../lib/server/peer-reminders');
const { localSlot, meetingUrl } = await import('../lib/mock-peer');

const HOUR = 3600000;
const person = (id: string, extra: Partial<Person> = {}): Person => ({
  id,
  name: `Real ${id}`,
  email: `${id}@example.test`,
  role: 'student',
  verified: true,
  ...extra,
});
function call(p: Person | null, method: string, path: string, body?: unknown, zh = false) {
  const url = new URL(`https://cswork.test/api/oj/${path}`);
  return handleOj(
    new Request(url, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', ...(zh ? { 'x-locale': 'zh' } : {}) },
    }),
    p,
    url.pathname.split('/').slice(3),
  );
}
async function status(p: Person | null, method: string, path: string, body?: unknown) {
  try {
    return (await call(p, method, path, body)).status;
  } catch (error) {
    return (error as { status?: number }).status ?? 400;
  }
}
type State = {
  request: { kind: string; expired: boolean } | null;
  pairs: {
    id: string;
    slot: number;
    start: number;
    partner: string;
    meetUrl: string;
    status: string;
    rounds: { set: string; as: string }[];
    reported: boolean;
    reportedMe: boolean;
    canReport: boolean;
    canCancel: boolean;
  }[];
  paused: boolean;
};
const ok = async (p: Person, method: string, path: string, body?: unknown, zh = false) => {
  const response = await call(p, method, path, body, zh);
  assert.ok(response.status < 300, `${path} ${response.status}`);
  return (await response.json()) as State;
};
const hour = Math.floor(Date.now() / HOUR);
const ask = (name: string, slots: number[], extra = {}) => ({ displayName: name, kind: 'phone', level: 'new-grad', slots, tz: -480, ...extra });
const inbox = (user: string) =>
  sqlite().prepare('SELECT title,body,href FROM notifications WHERE user_id=? ORDER BY created_at,rowid').all(user) as {
    title: string;
    body: string;
    href: string;
  }[];

before(() => migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') }));
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('meeting links only point at known meeting hosts over https', () => {
  assert.equal(meetingUrl('https://meet.google.com/abc-defg-hij'), true);
  assert.equal(meetingUrl('https://us02web.zoom.us/j/123'), true);
  assert.equal(meetingUrl('http://zoom.us/j/1'), false);
  assert.equal(meetingUrl('https://zoom.us.evil.test/j/1'), false);
  assert.equal(meetingUrl('https://user:pw@meet.google.com/x'), false);
  assert.equal(meetingUrl('javascript:alert(1)'), false);
  assert.equal(localSlot(Date.UTC(2026, 9, 15, 14) / HOUR, -480), '2026-10-15 22:00 (UTC+8)');
  assert.equal(localSlot(Date.UTC(2026, 9, 15, 14) / HOUR, 330), '2026-10-15 08:30 (UTC-5:30)');
});

void test('requests need an account, a verified email and future slots in the next week', async () => {
  assert.equal(await status(null, 'GET', 'peer'), 401);
  assert.equal(await status(person('p-unverified', { verified: false }), 'POST', 'peer', ask('X', [hour + 5])), 403);
  assert.equal(await status(person('p-past'), 'POST', 'peer', ask('X', [hour - 1, hour + 1])), 400);
  assert.equal(await status(person('p-far'), 'POST', 'peer', ask('X', [hour + 24 * 8])), 400);
  assert.equal(await status(person('p-kind'), 'POST', 'peer', ask('X', [hour + 5], { kind: 'nope' })), 400);
  assert.equal(await status(person('p-many'), 'POST', 'peer', ask('X', Array.from({ length: 25 }, (_, i) => hour + 3 + i))), 400);
  // A name that renders blank is not a name.
  assert.equal(await status(person('p-blank'), 'POST', 'peer', ask('ㅤ', [hour + 5])), 400);
});

void test('the oldest overlapping request becomes the partner, at the earliest shared hour', async () => {
  const amy = person('p-amy');
  const bob = person('p-bob');
  const cat = person('p-cat');
  const waiting = await ok(amy, 'POST', 'peer', ask('Amy', [hour + 3, hour + 5, hour + 9]), true);
  assert.equal(waiting.request?.kind, 'phone');
  assert.equal(waiting.pairs.length, 0);
  // One open request at a time.
  assert.equal(await status(amy, 'POST', 'peer', ask('Amy', [hour + 4])), 409);
  // Another level never matches.
  await ok(cat, 'POST', 'peer', ask('Cat', [hour + 5], { level: 'senior' }));
  const matched = await ok(bob, 'POST', 'peer', ask('Bob', [hour + 9, hour + 5, hour + 6]));
  assert.equal(matched.request, null);
  const pair = matched.pairs[0];
  assert.equal(pair.slot, hour + 5);
  assert.equal(pair.start, pair.slot * HOUR);
  assert.equal(pair.partner, 'Amy');
  assert.equal(pair.status, 'scheduled');
  assert.equal(pair.canCancel, true);
  assert.equal(pair.canReport, false);
  // Bob is the interviewer first, then the candidate; each round its own set.
  assert.deepEqual(pair.rounds.map((r) => r.as), ['interviewer', 'candidate']);
  assert.notEqual(pair.rounds[0].set, pair.rounds[1].set);
  assert.ok(pair.rounds.every((r) => /^[a-z0-9]{8}$/.test(r.set)));
  const amys = await ok(amy, 'GET', 'peer');
  assert.equal(amys.request, null);
  assert.equal(amys.pairs[0].partner, 'Bob');
  assert.deepEqual(amys.pairs[0].rounds, [
    { set: pair.rounds[0].set, as: 'candidate' },
    { set: pair.rounds[1].set, as: 'interviewer' },
  ]);
  // Both hear about it, in their own language and zone; never the other's account name.
  const [toAmy] = inbox(amy.id);
  const [toBob] = inbox(bob.id);
  assert.equal(toAmy.title, '同伴模拟面试已匹配');
  assert.equal(toAmy.href, `/?view=mock-peer&pair=${pair.id}`);
  assert.match(toAmy.body, /^SWE 电话面 · .* \(UTC\+8\) · 对方: Bob$/);
  assert.match(toBob.body, /^SWE phone screen · .* · Partner: Amy$/);
  assert.ok(!toAmy.body.includes('Real') && !toBob.body.includes('Real'));
  // Cat (senior) is still waiting.
  assert.ok((await ok(cat, 'GET', 'peer')).request);
});

void test('only the two partners touch a pair; links must be meeting links', async () => {
  const dan = person('p-dan');
  const eve = person('p-eve');
  await ok(dan, 'POST', 'peer', ask('Dan', [hour + 30], { kind: 'behavioral' }));
  const pair = (await ok(eve, 'POST', 'peer', ask('Eve', [hour + 30], { kind: 'behavioral' }))).pairs[0];
  assert.equal(await status(person('p-stranger'), 'POST', `peer/${pair.id}/link`, { url: 'https://zoom.us/j/1' }), 404);
  assert.equal(await status(dan, 'POST', `peer/${pair.id}/link`, { url: 'https://evil.test/zoom' }), 400);
  const linked = await ok(dan, 'POST', `peer/${pair.id}/link`, { url: 'https://zoom.us/j/123' });
  assert.equal(linked.pairs[0].meetUrl, 'https://zoom.us/j/123');
  assert.equal((await ok(eve, 'GET', 'peer')).pairs[0].meetUrl, 'https://zoom.us/j/123');
  // No reporting before it starts; cancelling tells the partner.
  assert.equal(await status(eve, 'POST', `peer/${pair.id}/no-show`, {}), 409);
  const cancelled = await ok(eve, 'POST', `peer/${pair.id}/cancel`, {});
  assert.equal(cancelled.pairs[0].status, 'cancelled');
  assert.equal(inbox(dan.id).at(-1)?.title, '同伴模拟面试已取消');
  assert.equal(await status(dan, 'POST', `peer/${pair.id}/cancel`, {}), 409);
  // Dan's request is back in the queue with its hours; the cancel counts against Eve alone.
  assert.equal((await ok(dan, 'GET', 'peer')).request?.kind, 'behavioral');
  assert.equal((await ok(eve, 'GET', 'peer')).request, null);
  assert.equal(cancels(eve.id), 1);
  assert.equal(cancels(dan.id), 0);
});

void test('three cancels in a week pause the canceller; the victim keeps its place each time', async () => {
  const vic = person('p-vic');
  const troll = person('p-troll');
  await ok(vic, 'POST', 'peer', ask('Vic', [hour + 70, hour + 71], { kind: 'onsite' }));
  for (let i = 0; i < 3; i++) {
    const pair = (await ok(troll, 'POST', 'peer', ask('T', [hour + 70], { kind: 'onsite' }))).pairs.find((p) => p.status === 'scheduled')!;
    await ok(troll, 'POST', `peer/${pair.id}/cancel`, {});
    assert.ok((await ok(vic, 'GET', 'peer')).request);
  }
  assert.equal(await status(troll, 'POST', 'peer', ask('T', [hour + 70], { kind: 'onsite' })), 403);
});

void test('a no-show report answered with one the other way counts for neither side', async () => {
  const now = Date.now();
  const [sam, sock] = [person('p-sam'), person('p-sock')];
  requestMatch(sam, ask('Sam', [hour + 80], { kind: 'onsite', level: 'senior' }), 'en', now);
  const pairId = requestMatch(sock, ask('Sock', [hour + 80], { kind: 'onsite', level: 'senior' }), 'en', now)!;
  assert.ok(pairId);
  // Booked yesterday, started 20 minutes ago.
  sqlite().prepare('UPDATE mock_match_pairs SET slot=?,created_at=? WHERE id=?').run(Math.floor((now - 20 * 60000) / HOUR), now - 86400000, pairId);
  await ok(sock, 'POST', `peer/${pairId}/no-show`, {});
  assert.equal(noShows(sam.id), 1);
  assert.equal((await ok(sam, 'GET', 'peer')).pairs.find((p) => p.id === pairId)!.canReport, true);
  await ok(sam, 'POST', `peer/${pairId}/no-show`, {});
  assert.equal(noShows(sam.id), 0);
  assert.equal(noShows(sock.id), 0);
});

void test('two no-show reports from different partners pause matching', async () => {
  const now = Date.now();
  const flaky = person('p-flaky');
  const reporters = [person('p-r1'), person('p-r2')];
  for (const [i, reporter] of reporters.entries()) {
    const id = requestMatch(reporter, ask(`R${i}`, [hour + 40 + i], { kind: 'ds' }), 'en', now);
    assert.equal(id, null);
    const pairId = requestMatch(flaky, ask('Flaky', [hour + 40 + i], { kind: 'ds' }), 'en', now);
    assert.ok(pairId);
    // The session started 20 minutes ago.
    sqlite().prepare('UPDATE mock_match_pairs SET slot=?,created_at=? WHERE id=?').run(Math.floor((now - 20 * 60000) / HOUR) - i, now - 86400000, pairId);
    const state = await ok(reporter, 'GET', 'peer');
    const pair = state.pairs.find((p) => p.id === pairId)!;
    assert.equal(pair.canReport, true);
    assert.equal(pair.canCancel, false);
    const after = await ok(reporter, 'POST', `peer/${pairId}/no-show`, {});
    assert.equal(after.pairs.find((p) => p.id === pairId)!.reported, true);
    assert.equal(await status(reporter, 'POST', `peer/${pairId}/no-show`, {}), 409);
    assert.equal((await ok(flaky, 'GET', 'peer')).pairs.find((p) => p.id === pairId)!.reportedMe, true);
  }
  assert.equal(noShows(flaky.id), 2);
  assert.equal(inbox(flaky.id).at(-1)?.title, '对方报告你没有出席模拟面试');
  assert.equal((await ok(flaky, 'GET', 'peer')).paused, true);
  assert.equal(await status(flaky, 'POST', 'peer', ask('Flaky', [hour + 50])), 403);
});

void test('a waiting request can be withdrawn, and one whose hours passed gives way', async () => {
  const fay = person('p-fay');
  await ok(fay, 'POST', 'peer', ask('Fay', [hour + 60], { kind: 'mle' }));
  assert.equal((await ok(fay, 'POST', 'peer/cancel', {})).request, null);
  await ok(fay, 'POST', 'peer', ask('Fay', [hour + 61], { kind: 'mle' }));
  sqlite().prepare(`UPDATE mock_match_requests SET slots_json=? WHERE user_id=? AND status='open'`).run(JSON.stringify([hour - 3]), fay.id);
  assert.equal((await ok(fay, 'GET', 'peer')).request?.expired, true);
  assert.ok((await ok(fay, 'POST', 'peer', ask('Fay', [hour + 62], { kind: 'mle' }))).request);
});

void test('practice now pairs two instant requests for the hour under way, and lapses after 15 minutes', async () => {
  const now = Date.now();
  const [ivy, jon, kim, lee, max] = ['p-ivy', 'p-jon', 'p-kim', 'p-lee', 'p-max'].map((id) => person(id));
  const now_ = (name: string) => ({ ...ask(name, [], { kind: 'behavioral', level: 'mid' }), instant: true });
  // A booked request for the same type and level never takes an instant one, nor the other way.
  await ok(jon, 'POST', 'peer', ask('Jon', [hour + 3], { kind: 'behavioral', level: 'mid' }));
  const waiting = await ok(ivy, 'POST', 'peer', now_('Ivy'));
  assert.equal((waiting.request as unknown as { instant: boolean }).instant, true);
  assert.equal(waiting.pairs.length, 0);
  const matched = await ok(kim, 'POST', 'peer', now_('Kim'));
  const pair = matched.pairs[0];
  assert.equal(pair.partner, 'Ivy');
  assert.equal(pair.slot, Math.floor(now / HOUR));
  assert.ok(pair.start >= now && pair.start < (pair.slot + 1) * HOUR, 'it starts when it matched');
  // Under way: no cancelling, and no no-show report until 10 minutes after it matched.
  assert.equal(pair.canCancel, false);
  assert.equal(pair.canReport, false);
  assert.ok((await ok(jon, 'GET', 'peer')).request);
  // Nobody else within 15 minutes: the request lapses, and a new one may be filed.
  await ok(lee, 'POST', 'peer', now_('Lee'));
  sqlite().prepare(`UPDATE mock_match_requests SET created_at=? WHERE user_id=? AND status='open'`).run(now - 16 * 60000, lee.id);
  assert.equal((await ok(lee, 'GET', 'peer')).request?.expired, true);
  assert.equal((await ok(max, 'POST', 'peer', now_('Max'))).pairs.length, 0, 'a lapsed instant request matches nobody');
  await sendPeerReminders(now);
  assert.equal((await ok(lee, 'GET', 'peer')).request, null);
});

void test('partners with target companies and topics in common are matched first, and told so', async () => {
  const [old, fan, me] = [person('p-old'), person('p-fan'), person('p-me')];
  const mine = { kind: 'mle', level: 'intern' };
  // Neither shares an hour with the other; each shares one with me.
  await ok(old, 'POST', 'peer', ask('Old', [hour + 30], mine));
  await ok(fan, 'POST', 'peer', ask('Fan', [hour + 31], { ...mine, focus: { companies: [], topics: ['dp-grid', 'binary-search'] } }));
  assert.equal(await status(me, 'POST', 'peer', ask('Me', [hour + 30], { ...mine, focus: { companies: [], topics: ['nope'] } })), 400);
  assert.equal(
    await status(me, 'POST', 'peer', ask('Me', [hour + 30], { ...mine, focus: { companies: ['no-such-co'], topics: [] } })),
    400,
  );
  const topics = ['binary-search', 'dp-grid', 'graph-topological'];
  const matched = await ok(me, 'POST', 'peer', ask('Me', [hour + 30, hour + 31], { ...mine, focus: { companies: [], topics } }), true);
  assert.equal(matched.pairs[0].partner, 'Fan');
  assert.match(inbox(me.id)[0].body, / · 共同关注: 二分查找、网格动规$/);
  assert.match(inbox(fan.id)[0].body, / · In common: Binary Search, Grid DP$/);
  // Old still waits: in common beats older.
  assert.ok((await ok(old, 'GET', 'peer')).request);
});

void test('reminder mails go out once a day ahead and once an hour ahead, to verified sides that kept them on', async () => {
  process.env.RESEND_API_KEY = 're_test';
  process.env.MAIL_FROM = 'CSWork <mail@cswork.test>';
  process.env.APP_URL = 'https://cswork.test';
  const realFetch = globalThis.fetch;
  const mails: { to: string[]; subject: string; text: string }[] = [];
  let limited = 0;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    if (limited > 0) {
      limited--;
      return new Response('rate limited', { status: 429 });
    }
    mails.push(JSON.parse(String(init.body)));
    return Response.json({ id: 'x' });
  }) as typeof fetch;
  try {
    const [rae, sol, tia] = [person('p-rae'), person('p-sol'), person('p-tia')];
    const insert = sqlite().prepare('INSERT INTO "user"(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?)');
    insert.run(rae.id, rae.name, rae.email, 1, 0, 0);
    insert.run(sol.id, sol.name, sol.email, 0, 0, 0);
    insert.run(tia.id, tia.name, tia.email, 1, 0, 0);
    const now = Date.now();
    const slot = hour + 6;
    requestMatch(rae, ask('Rae', [slot], { kind: 'ds', level: 'senior' }), 'zh', now);
    const pairId = requestMatch(sol, ask('Sol', [slot], { kind: 'ds', level: 'senior' }), 'en', now)!;
    sqlite().prepare('UPDATE mock_match_pairs SET meet_url=? WHERE id=?').run('https://meet.google.com/abc-defg-hij', pairId);
    // Sol's email is unverified: only Rae hears, in her language and zone. A rate-limited send is retried next tick.
    limited = 1;
    assert.equal(await sendPeerReminders(now), 0);
    assert.equal(await sendPeerReminders(now + 10 * 60000), 1);
    assert.equal(await sendPeerReminders(now + 11 * 60000), 0, 'never twice');
    assert.deepEqual(mails[0].to, [rae.email]);
    assert.equal(mails[0].subject, `同伴模拟面试提醒：${localSlot(slot, -480)}`);
    assert.match(mails[0].text, /同伴：Sol\n会议链接：https:\/\/meet\.google\.com\/abc-defg-hij/);
    assert.match(mails[0].text, new RegExp(`https://cswork\\.test/\\?view=mock-peer&pair=${pairId}`));
    assert.match(mails[0].text, /\(UTC\+8\)/);
    assert.equal(await sendPeerReminders(slot * HOUR - 30 * 60000), 1);
    assert.equal(mails[1].subject, '同伴模拟面试 1 小时后开始');
    assert.equal(await sendPeerReminders(slot * HOUR - 20 * 60000), 0);
    // Reminders off: Tia books with them off; matched under two hours ahead, only the hour mail would go.
    const late = hour + 2;
    requestMatch(tia, ask('Tia', [late], { kind: 'ds', level: 'senior', remind: false }), 'en', now);
    requestMatch(rae, ask('Rae', [late], { kind: 'ds', level: 'senior' }), 'en', now);
    assert.equal(await sendPeerReminders(late * HOUR - 90 * 60000), 0);
    assert.equal(await sendPeerReminders(late * HOUR - 50 * 60000), 1);
    assert.deepEqual(mails.at(-1)!.to, [rae.email]);
    assert.equal(mails.at(-1)!.subject, 'Your peer mock interview starts in an hour');
    assert.match(mails.at(-1)!.text, /Partner: Tia\nCall link: not set yet/);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.RESEND_API_KEY;
    delete process.env.MAIL_FROM;
  }
});
