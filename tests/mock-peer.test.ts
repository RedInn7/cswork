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
const { localSlot, noShows, requestMatch } = await import('../lib/server/mock-peer');
const { meetingUrl } = await import('../lib/mock-peer');

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
    sqlite().prepare('UPDATE mock_match_pairs SET slot=? WHERE id=?').run(Math.floor((now - 20 * 60000) / HOUR) - i, pairId);
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
