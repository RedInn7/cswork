import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import Database from 'better-sqlite3';
import type { Person } from '../lib/server/auth';

const folder = mkdtempSync(join(tmpdir(), 'cswork-funnel-'));
process.env.DATABASE_PATH = join(folder, 'app.sqlite');
process.env.METRICS_DATABASE_PATH = join(folder, 'metrics.sqlite');
execFileSync(process.execPath, ['scripts/migrate.mjs'], { env: process.env });
const { sqlite } = await import('../db/sqlite');
const { handleMetrics, record } = await import('../lib/server/metrics');
const main = sqlite();

const DAY = 86_400_000;
const today = Math.floor(Date.now() / DAY) * DAY;
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const person = (id: string, role: Person['role'] = 'student'): Person => ({
  id, email: `${id}@example.test`, name: id, role, verified: true,
});
const view = (vid: string, params: object, p: Person | null = null) =>
  handleMetrics(
    new Request('http://localhost/api/metrics', {
      method: 'POST',
      body: JSON.stringify({ vid, events: [{ name: 'page_view', params }] }),
      headers: { 'x-real-ip': '10.0.0.1' },
    }),
    p,
    [],
  );

after(() => rmSync(folder, { recursive: true, force: true }));

void test('funnel and D1/D7 return come from page views, server-side sign-ins and submissions', async () => {
  for (const [id, at] of [
    ['u-old', today - 30 * DAY], ['u1', today - 8 * DAY + 1], ['u2', today - 8 * DAY + 2],
    ['u3', today - 2 * DAY + 1], ['u5', today - DAY + 1], ['u4', today + 1],
  ] as const)
    main.prepare('INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,1,?,?)').run(id, id, `${id}@example.test`, at, at);
  // Appended in time order, as the app does.
  let n = 0;
  for (const [user, at, mode, status] of [
    ['u-old', today - 3 * DAY, 'judge', 'accepted'], // an older account: not a first run or AC
    ['u2', today - DAY + 5, 'run', 'finished'], // u2 back on day 7, though never seen signed in
    ['u1', today + 10, 'run', 'finished'],
    ['u1', today + 20, 'judge', 'accepted'],
    ['u4', today + 30, 'judge', 'wrong_answer'],
  ] as const)
    main
      .prepare(
        `INSERT INTO submissions(id,user_id,problem_id,language,code,status,total,created_at,updated_at,mode,finished_at)
         VALUES(?,?,'lc-1','python','code',?,1,?,?,?,?)`,
      )
      .run(`s-${++n}`, user, status, at, at, mode, at + 100);

  await view('visitor-1111', { view: 'problems' });
  await view('visitor-1111', { view: 'problem' });
  await view('visitor-2222', { view: 'problems' }, person('u1'));
  await view('visitor-3333', { view: 'content', type: 'guide', slug: 'acme' });
  await view('visitor-4444', { view: 'problems' }, person('u3'));
  record('login', 'u-old', { method: 'email' });
  record('login', 'u5', { method: 'google' }); // back today: D1 not over yet
  record('login', 'u1', { method: 'github' });
  record('sign_up', 'u4', { method: 'google' });
  record('login', 'u4', { method: 'google' });
  const writer = new Database(process.env.METRICS_DATABASE_PATH!);
  const earlier = writer.prepare(`INSERT INTO events(at,day,name,vid,user_id,params) VALUES(?,?,'page_view','visitor-2222','u1',?)`);
  earlier.run(today - 7 * DAY, dayOf(today - 7 * DAY), '{"view":"problems"}'); // u1 on day 1
  earlier.run(today - DAY, dayOf(today - DAY), '{"view":"knowledge"}'); // u1 on day 7
  writer
    .prepare(`INSERT INTO events(at,day,name,vid,user_id,params) VALUES(?,?,'page_view','visitor-4444','u3',?)`)
    .run(today - DAY, dayOf(today - DAY), '{"view":"problems"}'); // u3 back the day after signing up
  // Server-side events carry no visitor id and are never counted as visitors.
  assert.deepEqual(
    writer.prepare(`SELECT name,user_id,params FROM events WHERE vid='server' ORDER BY id`).raw().all(),
    [
      ['login', 'u-old', '{"method":"email"}'], ['login', 'u5', '{"method":"google"}'],
      ['login', 'u1', '{"method":"github"}'], ['sign_up', 'u4', '{"method":"google"}'],
      ['login', 'u4', '{"method":"google"}'],
    ],
  );
  writer.close();

  const s = await (
    await handleMetrics(new Request('http://localhost/api/metrics/summary?days=14'), person('owner', 'teacher'), ['summary'])
  ).json();
  assert.equal(s.totals.visitors, 4);
  assert.equal(s.totals.signups, 5);
  assert.equal(s.daily[13 - 8].signups, 2);
  // The last steps are this range's signups: u1 got an AC, u2 and u4 ran code; u-old is left out.
  assert.deepEqual(s.funnel, { visitors: 4, problemBank: 3, problem: 1, signedUp: 5, ran: 3, accepted: 1 });
  // A return day counts once it is over: u5 is back today, which is not.
  assert.deepEqual(s.retention, [
    { day: dayOf(today), users: 1, d1: null, d7: null },
    { day: dayOf(today - DAY), users: 1, d1: null, d7: null },
    { day: dayOf(today - 2 * DAY), users: 1, d1: 1, d7: null },
    { day: dayOf(today - 8 * DAY), users: 2, d1: 1, d7: 2 },
  ]);
});
