import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import Database from 'better-sqlite3';
import type { Person } from '../lib/server/auth';

const folder = mkdtempSync(join(tmpdir(), 'cswork-metrics-'));
process.env.DATABASE_PATH = join(folder, 'app.sqlite');
process.env.METRICS_DATABASE_PATH = join(folder, 'metrics.sqlite');
execFileSync(process.execPath, ['scripts/migrate.mjs'], { env: process.env });
const { sqlite } = await import('../db/sqlite');
const { handleMetrics } = await import('../lib/server/metrics');
const main = sqlite();

const DAY = 86_400_000;
const today = Math.floor(Date.now() / DAY) * DAY;
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const person = (id: string, role: Person['role'] = 'student'): Person => ({
  id, email: `${id}@example.test`, name: id, role, verified: true,
});
const owner = person('owner', 'teacher'), alice = person('alice');
const post = (body: unknown, p: Person | null = null, ip = '10.0.0.1') =>
  handleMetrics(
    new Request('http://localhost/api/metrics', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'content-type': 'text/plain;charset=UTF-8', 'x-real-ip': ip },
    }),
    p,
    [],
  );
const get = async (query: string, p: Person | null = owner) =>
  (await handleMetrics(new Request(`http://localhost/api/metrics/summary${query}`), p, ['summary'])).json();
const status = (code: number) => (e: unknown) => (e as { status?: number }).status === code;
// The module creates the file on first use; read it back through a second connection.
let events: Database.Database;
const stored = () =>
  events.prepare('SELECT name,vid,user_id,day,params FROM events ORDER BY id').all() as {
    name: string; vid: string; user_id: string | null; day: string; params: string;
  }[];

after(() => {
  events?.close();
  rmSync(folder, { recursive: true, force: true });
});

void test('ingest keeps allowed events and params, coerced and clamped', async () => {
  const response = await post({
    vid: 'visitor-0001',
    events: [
      { name: 'page_view', params: { view: 'content', type: 'guide', slug: 'acme', email: 'a@b.c' } },
      { name: 'made_up', params: { view: 'x' } },
      { name: 'constructor' },
      {
        name: 'judge_result',
        params: {
          mode: 'submit', language: { nested: true }, verdict: 'v'.repeat(500), duration_ms: 9e9,
          queue_ms: '250', server_ms: 'Infinity', passed: -3, total: 'many',
        },
      },
      { name: 'judge_error', params: { stage: '  poll  ', status: 503, extra: true } },
      { name: 'search', params: { q: 'Two   Sum ' } },
      'not an event',
      null,
    ],
  });
  assert.equal(response.status, 204);
  // The first view of a visit says where it came from; sign-ins are recorded server-side only.
  await post({
    vid: 'visitor-0002',
    events: [
      { name: 'login', params: { method: 'email' } },
      {
        name: 'page_view',
        params: {
          view: 'problems', ref: 'google.com', utm_source: ' Reddit ', utm_medium: 'CPC',
          utm_campaign: 'Launch '.repeat(20), utm_term: 'private', referrer: 'https://google.com/?q=x',
        },
      },
    ],
  }, alice);
  events = new Database(process.env.METRICS_DATABASE_PATH!, { readonly: true });
  // No IP addresses or user agents, ever.
  assert.deepEqual(
    (events.prepare('PRAGMA table_info(events)').all() as { name: string }[]).map((c) => c.name),
    ['id', 'at', 'day', 'name', 'vid', 'user_id', 'params'],
  );
  const rows = stored();
  assert.deepEqual(rows.map((r) => [r.name, r.vid, r.user_id, r.day]), [
    ['page_view', 'visitor-0001', null, dayOf(Date.now())],
    ['judge_result', 'visitor-0001', null, dayOf(Date.now())],
    ['judge_error', 'visitor-0001', null, dayOf(Date.now())],
    ['search', 'visitor-0001', null, dayOf(Date.now())],
    ['page_view', 'visitor-0002', 'alice', dayOf(Date.now())],
  ]);
  assert.deepEqual(rows.map((r) => JSON.parse(r.params)), [
    { view: 'content', type: 'guide', slug: 'acme' },
    { mode: 'submit', verdict: 'v'.repeat(120), passed: 0, duration_ms: 3_600_000, queue_ms: 250 },
    { stage: 'poll', status: '503' },
    { q: 'two sum' },
    { view: 'problems', ref: 'google.com', utm_source: 'reddit', utm_medium: 'cpc', utm_campaign: 'launch '.repeat(10).slice(0, 64) },
  ]);
});

void test('malformed and oversized beacons are rejected, never a server error', async () => {
  for (const body of [
    'not json', 'null', '[]', { events: [] }, { vid: 'short', events: [] }, { vid: 'has spaces!', events: [] },
    { vid: 'x'.repeat(65), events: [] }, { vid: 'visitor-0001' }, { vid: 'visitor-0001', events: {} },
    { vid: 'visitor-0001', events: Array.from({ length: 21 }, () => ({ name: 'login' })) },
  ])
    await assert.rejects(post(body), status(400), JSON.stringify(body));
  await assert.rejects(post({ vid: 'visitor-0001', events: [{ name: 'search', params: { q: 'x'.repeat(9000) } }] }), status(413));
  assert.equal(stored().length, 5);
});

void test('beacons are rate limited per address (or per account when signed in)', async () => {
  const fixed = mock.method(Date, 'now', () => today + 30_000); // one rate-limit window
  try {
    for (let i = 0; i < 300; i++) assert.equal((await post({ vid: 'visitor-0003', events: [] }, null, '10.9.9.9')).status, 204);
    await assert.rejects(post({ vid: 'visitor-0003', events: [] }, null, '10.9.9.9'), status(429));
    assert.equal((await post({ vid: 'visitor-0003', events: [] }, null, '10.9.9.10')).status, 204);
  } finally {
    fixed.mock.restore();
  }
});

void test('summary: every day in range, numbers from both databases', async () => {
  // Users: two today, one 3 days ago, one outside the range.
  for (const [id, at] of [['u-old', today - 20 * DAY], ['u-3', today - 3 * DAY + 5], ['u-a', today + 100], ['u-b', today + 200]] as const)
    main.prepare('INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,1,?,?)').run(id, id, `${id}@example.test`, at, at);
  // Submissions are appended in time order, as the app does.
  let n = 0;
  const submit = (at: number, mode: string, status: string, language: string, latency: number | null) =>
    main
      .prepare(
        `INSERT INTO submissions(id,user_id,problem_id,language,code,status,total,created_at,updated_at,mode,finished_at)
         VALUES(?,'u-a','lc-1',?,'code',?,1,?,?,?,?)`,
      )
      .run(`s-${++n}`, language, status, at, at, mode, latency === null ? null : at + latency);
  submit(today - 20 * DAY, 'judge', 'accepted', 'python', 10); // outside the range
  submit(today - 2 * DAY, 'judge', 'accepted', 'java', 4000);
  submit(today - 2 * DAY + 1, 'run', 'wrong_answer', 'python', 100);
  submit(today + 1, 'judge', 'accepted', 'python', 1000);
  submit(today + 2, 'judge', 'wrong_answer', 'python', 3000);
  submit(today + 3, 'judge', 'accepted', 'cpp', 2000);
  submit(today + 4, 'run', 'finished', 'python', 500);
  submit(today + 5, 'judge', 'cancelled', 'go', 60_000); // cancelled: no judge latency
  submit(today + 6, 'judge', 'queued', 'go', null);
  submit(today + 7, 'judge', 'compiling', 'go', null);
  submit(today + 8, 'run', 'running', 'go', null);

  const writer = new Database(process.env.METRICS_DATABASE_PATH!);
  writer.prepare('DELETE FROM events').run();
  const A = 'visitor-aaaa', B = 'visitor-bbbb';
  const view = (params: object) => ({ name: 'page_view', params });
  await post({ vid: A, events: [view({ view: 'content', type: 'guide', slug: 'acme' }), view({ view: 'content', type: 'guide', slug: 'acme' }), view({ view: 'problems' }), { name: 'search', params: { q: 'Two Sum' } }] });
  await post({
    vid: B,
    events: [
      view({ view: 'content', type: 'guide', slug: 'acme' }),
      { name: 'search', params: { q: 'two sum' } },
      { name: 'search', params: { q: 'LRU' } },
      { name: 'language_switch', params: { locale: 'zh' } },
      { name: 'judge_result', params: { mode: 'submit', duration_ms: 100, queue_ms: 10 } },
      { name: 'judge_result', params: { mode: 'submit', duration_ms: 300 } },
      { name: 'judge_result', params: { mode: 'run', duration_ms: 50 } },
      { name: 'judge_error', params: { stage: 'poll', status: '503' } },
      { name: 'judge_error', params: { stage: 'poll', status: '503' } },
      { name: 'judge_error', params: { stage: 'submit', status: 'network' } },
    ],
  }, alice);
  const earlier = writer.prepare('INSERT INTO events(at,day,name,vid,user_id,params) VALUES(?,?,?,?,NULL,?)');
  earlier.run(today - 3 * DAY, dayOf(today - 3 * DAY), 'page_view', 'visitor-cccc', '{"view":"oa"}');
  earlier.run(today - 3 * DAY, dayOf(today - 3 * DAY), 'page_view', A, '{"view":"problems"}');
  writer.close();

  const s = await get('?days=14');
  assert.deepEqual(s.range, { days: 14, from: dayOf(today - 13 * DAY), to: dayOf(today) });
  assert.equal(typeof s.generatedAt, 'number');
  assert.deepEqual(s.totals, { pageViews: 6, visitors: 3, signups: 3, submissions: 7, runs: 3, accepted: 3, judgeErrors: 3 });
  assert.deepEqual(s.daily.map((d: { day: string }) => d.day), Array.from({ length: 14 }, (_, i) => dayOf(today - (13 - i) * DAY)));
  const on = (ago: number) => s.daily[13 - ago];
  assert.deepEqual(on(0), { day: dayOf(today), pageViews: 4, visitors: 2, signups: 2, submissions: 6, runs: 2, accepted: 2 });
  assert.deepEqual(on(1), { day: dayOf(today - DAY), pageViews: 0, visitors: 0, signups: 0, submissions: 0, runs: 0, accepted: 0 });
  assert.deepEqual(on(2), { day: dayOf(today - 2 * DAY), pageViews: 0, visitors: 0, signups: 0, submissions: 1, runs: 1, accepted: 1 });
  assert.deepEqual(on(3), { day: dayOf(today - 3 * DAY), pageViews: 2, visitors: 2, signups: 1, submissions: 0, runs: 0, accepted: 0 });
  // Server latency: created -> finished of judged formal submissions, nearest-rank percentiles.
  assert.deepEqual(s.judge.server, { count: 4, p50: 2000, p90: 4000, p99: 4000, avg: 2500 });
  assert.deepEqual(s.judge.client, { count: 2, p50: 100, p90: 300, p99: 300 });
  assert.deepEqual(s.judge.run, { count: 1, p50: 50, p90: 50 });
  assert.deepEqual(s.judge.queue, { count: 1, p50: 10, p90: 10 });
  assert.deepEqual(s.judge.byLanguage[0], { language: 'python', count: 2, p50: 1000 });
  assert.deepEqual(
    s.judge.byLanguage.slice(1).sort((a: { language: string }, b: { language: string }) => a.language.localeCompare(b.language)),
    [{ language: 'cpp', count: 1, p50: 2000 }, { language: 'java', count: 1, p50: 4000 }],
  );
  assert.deepEqual(s.judge.verdicts[0], { verdict: 'accepted', count: 3 });
  assert.deepEqual(new Set(s.judge.verdicts.slice(1).map((v: { verdict: string }) => v.verdict)), new Set(['wrong_answer', 'cancelled', 'queued', 'compiling']));
  assert.equal(s.judge.queuedNow, 1);
  assert.equal(s.judge.runningNow, 2);
  assert.deepEqual(s.topViews, [
    { view: 'content', type: 'guide', count: 3 },
    { view: 'problems', type: null, count: 2 },
    { view: 'oa', type: null, count: 1 },
  ]);
  assert.deepEqual(s.topContent, [{ type: 'guide', slug: 'acme', count: 3 }]);
  assert.deepEqual(s.topSearches, [{ q: 'two sum', count: 2 }, { q: 'lru', count: 1 }]);
  assert.deepEqual(s.errors, [{ stage: 'poll', status: '503', count: 2 }, { stage: 'submit', status: 'network', count: 1 }]);
  assert.deepEqual(s.locales, [{ locale: 'zh', count: 1 }]);
  // A one-day range; days are clamped to 1–90.
  const one = await get('?days=1');
  assert.deepEqual([one.totals.pageViews, one.totals.submissions, one.daily.length], [4, 6, 1]);
  assert.equal((await get('?days=500')).range.days, 90);
  assert.equal((await get('?days=-3')).range.days, 1);
  assert.equal((await get('?days=lots')).range.days, 14);
  assert.equal((await get('?days=90')).totals.submissions, 8);
});

void test('the summary is for teachers only', async () => {
  await assert.rejects(get('?days=14', null), status(401));
  await assert.rejects(get('?days=14', alice), status(403));
  await assert.rejects(handleMetrics(new Request('http://localhost/api/metrics'), owner, []), status(404));
});

void test('the summary is cached for a minute per range', async () => {
  const before = await get('?days=90');
  await post({ vid: 'visitor-dddd', events: [{ name: 'page_view', params: { view: 'oa' } }] });
  const cached = await get('?days=90');
  assert.equal(cached.generatedAt, before.generatedAt);
  assert.equal(cached.totals.pageViews, before.totals.pageViews);
  const real = Date.now();
  const later = mock.method(Date, 'now', () => real + 61_000);
  try {
    const fresh = await get('?days=90');
    assert.ok(fresh.generatedAt > before.generatedAt);
    assert.equal(fresh.totals.pageViews, before.totals.pageViews + 1);
  } finally {
    later.mock.restore();
  }
});

void test('events older than 120 days are pruned in small batches', async () => {
  const writer = new Database(process.env.METRICS_DATABASE_PATH!);
  const old = writer.prepare(`INSERT INTO events(at,day,name,vid,user_id,params) VALUES(?,?,'login','visitor-old',NULL,'{}')`);
  writer.transaction(() => {
    for (let i = 0; i < 1200; i++) old.run(today - 200 * DAY, dayOf(today - 200 * DAY));
  })();
  writer.close();
  const left = () => (events.prepare("SELECT COUNT(*) AS n FROM events WHERE vid='visitor-old'").get() as { n: number }).n;
  // The hourly check already ran; an hour later each beacon removes one batch until caught up.
  const real = Date.now();
  const later = mock.method(Date, 'now', () => real + 2 * 3_600_000);
  try {
    for (const remaining of [700, 200, 0, 0]) {
      await post({ vid: 'visitor-eeee', events: [] }, null, '10.7.7.7');
      assert.equal(left(), remaining);
    }
  } finally {
    later.mock.restore();
  }
  assert.ok(stored().some((r) => r.vid === 'visitor-dddd'), 'recent rows stay');
});
