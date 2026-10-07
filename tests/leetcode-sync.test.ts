import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type {
  LeetcodePage,
  LeetcodeProvider,
} from '../lib/server/leetcode-provider';
const dir = mkdtempSync(resolve(tmpdir(), 'leetcode-sync-test-'));
process.env.DATABASE_PATH = resolve(dir, 'db.sqlite');
const { sqlite } = await import('../db/sqlite');
const { changeLeetcodeSync, leetcodeSyncState } =
  await import('../lib/server/leetcode-sync');
const { createLeetcodeProvider } =
  await import('../lib/server/leetcode-provider');
const secrets = {
  session: 'privateSessionToken',
  csrfToken: 'privateCsrfToken',
};
before(() =>
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') }),
);
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});
function round(user: string, number = 1) {
  const id = randomUUID();
  sqlite()
    .prepare(
      'INSERT INTO practice_rounds(id,user_id,number,created_at,active) VALUES(?,?,?,?,?)',
    )
    .run(id, user, number, Date.now(), number === 1 ? 1 : 0);
  return id;
}
function record(id: string, accepted = true, slug = 'two-sum') {
  return {
    externalId: id,
    accepted,
    slug,
    title: 'Two Sum',
    language: 'python3',
    submittedAt: 1700000000000,
  };
}
function provider(
  pages: LeetcodePage[],
  identity = 'learner',
): LeetcodeProvider {
  return {
    identity: async () => identity,
    page: async () => {
      const page = pages.shift();
      if (!page) throw new Error('Unexpected page');
      return page;
    },
  };
}
function start(roundId: string, region: 'cn' | 'us' = 'cn') {
  return {
    action: 'start',
    region,
    roundId,
    idempotencyKey: randomUUID(),
    ...secrets,
  };
}
void test('separate external provenance, complete pagination, retained unmatched, no forged submissions, idempotent start', async () => {
  const user = 'sync-one',
    r = round(user),
    cmd = start(r);
  sqlite()
    .prepare(`INSERT INTO study_library(id,number,slug,title_zh,title_en,difficulty,topics_json,payload_json,content_hash,case_count,expected_count,imported_at)
    VALUES('lc-1',1,'two-sum','两数之和','Two Sum','简单','[]','{}','hash',0,0,1)`)
    .run();
  const p = provider([
    {
      records: [record('1'), record('2', false)],
      hasNext: true,
      lastKey: 'next',
    },
    { records: [record('3', true, 'unmapped')], hasNext: false, lastKey: '' },
  ]);
  const first = await changeLeetcodeSync(user, cmd, p);
  assert.equal(first.run.scanned, 2);
  assert.equal(first.run.accepted, 1);
  assert.equal(first.run.status, 'running');
  assert.deepEqual(await changeLeetcodeSync(user, cmd, p), first);
  await assert.rejects(
    changeLeetcodeSync(user, cmd, provider([], 'different-account')),
    /账号/,
  );
  const done = await changeLeetcodeSync(
    user,
    { action: 'continue', runId: first.run.id, ...secrets },
    p,
  );
  assert.equal(done.run.status, 'complete');
  assert.equal(done.run.scanned, 3);
  assert.equal(done.run.accepted, 2);
  assert.equal(done.run.matched, 1);
  assert.equal(done.run.unmatched, 1);
  const state = leetcodeSyncState(user);
  assert.equal(state.total, 2);
  assert.equal(state.summary.unmatched, 1);
  assert.equal(
    state.records.find((x) => x.externalId === '1')?.matchedProblemId,
    'lc-1',
  );
  assert.equal(
    (
      sqlite().prepare('SELECT count(*) n FROM submissions').get() as {
        n: number;
      }
    ).n,
    0,
  );
  assert.equal(
    (
      sqlite().prepare('SELECT count(*) n FROM oj_outbox').get() as {
        n: number;
      }
    ).n,
    0,
  );
  assert.ok(!JSON.stringify(state).includes(secrets.session));
  assert.ok(
    !JSON.stringify(
      sqlite().prepare('SELECT * FROM leetcode_sync_runs').all(),
    ).includes(secrets.session),
  );
  const nextRound = round(user, 2);
  assert.equal(
    (
      sqlite()
        .prepare(
          'SELECT count(*) n FROM leetcode_round_records WHERE round_id=?',
        )
        .get(nextRound) as { n: number }
    ).n,
    0,
  );
  const us = await changeLeetcodeSync(
    user,
    start(nextRound, 'us'),
    provider([{ records: [record('1')], hasNext: false, lastKey: '' }]),
  );
  assert.equal(us.run.accepted, 1);
  assert.equal(leetcodeSyncState(user).total, 3);
});
void test('ownership and account checks, failure/cancellation/resume keep round and no lost page', async () => {
  const user = 'sync-two',
    r = round(user),
    cmd = start(r);
  const first = await changeLeetcodeSync(
    user,
    cmd,
    provider([{ records: [record('20')], hasNext: true, lastKey: 'next' }]),
  );
  await assert.rejects(
    changeLeetcodeSync('other', { action: 'cancel', runId: first.run.id }),
    /不存在/,
  );
  await assert.rejects(
    changeLeetcodeSync(user, start(round('different'))),
    /不存在/,
  );
  await assert.rejects(
    changeLeetcodeSync(
      user,
      { action: 'continue', runId: first.run.id, ...secrets },
      provider([], 'another'),
    ),
    /账号/,
  );
  assert.equal(leetcodeSyncState(user).runs[0].status, 'failed');
  await changeLeetcodeSync(user, { action: 'cancel', runId: first.run.id });
  assert.equal(leetcodeSyncState(user).runs[0].status, 'cancelled');
  const done = await changeLeetcodeSync(
    user,
    { action: 'continue', runId: first.run.id, ...secrets },
    provider([{ records: [record('21')], hasNext: false, lastKey: '' }]),
  );
  assert.equal(done.run.status, 'complete');
  assert.equal(done.run.roundId, r);
  assert.equal(done.run.scanned, 2);
});
void test('concurrent continuations commit once, cancellation beats in-flight page', async () => {
  const user = 'sync-race',
    r = round(user);
  const first = await changeLeetcodeSync(
    user,
    start(r),
    provider([{ records: [], hasNext: true, lastKey: 'a' }]),
  );
  let release!: () => void;
  const wait = new Promise<void>((r) => {
    release = r;
  });
  const p: LeetcodeProvider = {
    identity: async () => 'learner',
    page: async () => {
      await wait;
      return { records: [record('30')], hasNext: true, lastKey: 'b' };
    },
  };
  const command = { action: 'continue', runId: first.run.id, ...secrets };
  const a = changeLeetcodeSync(user, command, p),
    b = changeLeetcodeSync(user, command, p);
  release();
  await Promise.all([a, b]);
  assert.equal(leetcodeSyncState(user).runs[0].scanned, 1);
  let release2!: () => void;
  const wait2 = new Promise<void>((r) => {
    release2 = r;
  });
  const pending = changeLeetcodeSync(user, command, {
    identity: async () => 'learner',
    page: async () => {
      await wait2;
      return { records: [record('31')], hasNext: false, lastKey: '' };
    },
  });
  await changeLeetcodeSync(user, { action: 'cancel', runId: first.run.id });
  release2();
  await pending;
  assert.equal(leetcodeSyncState(user).runs[0].status, 'cancelled');
  assert.equal(leetcodeSyncState(user).runs[0].scanned, 1);
});
void test('overlapping pages fail safely without partial commit', async () => {
  const user = 'sync-overlap',
    first = await changeLeetcodeSync(
      user,
      start(round(user)),
      provider([{ records: [record('40')], hasNext: true, lastKey: 'a' }]),
    );
  await assert.rejects(
    changeLeetcodeSync(
      user,
      { action: 'continue', runId: first.run.id, ...secrets },
      provider([
        { records: [record('41'), record('40')], hasNext: false, lastKey: '' },
      ]),
    ),
    /重复/,
  );
  const state = leetcodeSyncState(user);
  assert.equal(state.total, 1);
  assert.equal(state.runs[0].status, 'failed');
  assert.equal(state.runs[0].pages, 1);
});
void test('provider fixed HTTPS hosts, cookies per request, parser rejects non-JSON/invalid pages', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = (async (
    url: string | URL | Request,
    init: RequestInit = {},
  ) => {
    calls.push({ url: String(url), init });
    return Response.json(
      String(url).includes('graphql')
        ? { data: { userStatus: { isSignedIn: true, username: 'learner' } } }
        : {
            submissions_dump: [
              {
                id: 12,
                title_slug: 'two-sum',
                title: 'Two Sum',
                lang: 'python3',
                timestamp: '1700000000',
                status_display: 'Accepted',
              },
            ],
            has_next: false,
            last_key: '',
          },
    );
  }) as typeof fetch;
  const p = createLeetcodeProvider(fetcher);
  assert.equal(await p.identity('cn', secrets), 'learner');
  const page = await p.page('us', secrets, 20, 'next');
  assert.equal(page.records[0].submittedAt, 1700000000000);
  assert.equal(page.records[0].accepted, true);
  assert.equal(calls[0].url, 'https://leetcode.cn/graphql/');
  assert.ok(calls[1].url.startsWith('https://leetcode.com/api/submissions/'));
  assert.equal(calls[1].init.redirect, 'error');
  assert.equal(
    new Headers(calls[1].init.headers).get('cookie'),
    `LEETCODE_SESSION=${secrets.session}; csrftoken=${secrets.csrfToken}`,
  );
  for (const response of [
    new Response('verify', { status: 403 }),
    new Response('slow', { status: 429 }),
    new Response('<html/>', { headers: { 'content-type': 'text/html' } }),
    Response.json({ submissions_dump: [], has_next: true, last_key: 'a' }),
    Response.json({
      submissions_dump: [],
      has_next: false,
      unexpected: true,
      last_key: 2,
    }),
  ]) {
    await assert.rejects(
      createLeetcodeProvider((async () => response) as typeof fetch).page(
        'cn',
        secrets,
        0,
        '',
      ),
    );
  }
});
void test('provider bounds bodies, rejects invalid identity, and sanitizes transport errors', async () => {
  const failures = [
    Response.json({
      data: { userStatus: { isSignedIn: false, username: null } },
    }),
    Response.json({ errors: [{ message: secrets.session }] }),
    new Response('irrelevant', {
      headers: {
        'content-type': 'application/json',
        'content-length': String(3 * 1024 * 1024),
      },
    }),
    new Response(' '.repeat(2 * 1024 * 1024 + 1), {
      headers: { 'content-type': 'application/json' },
    }),
  ];
  for (const response of failures)
    await assert.rejects(
      createLeetcodeProvider((async () => response) as typeof fetch).identity(
        'cn',
        secrets,
      ),
      (e) => e instanceof Error && !e.message.includes(secrets.session),
    );
  await assert.rejects(
    createLeetcodeProvider((async () => {
      throw new Error(`network ${secrets.session}`);
    }) as typeof fetch).identity('us', secrets),
    (e) => e instanceof Error && !e.message.includes(secrets.session),
  );
  const c = new AbortController();
  c.abort();
  await assert.rejects(
    createLeetcodeProvider(
      (async () =>
        Response.json({
          data: { userStatus: { isSignedIn: true, username: 'learner' } },
        })) as typeof fetch,
      c.signal,
    ).identity('cn', secrets),
    /中断/,
  );
});
void test('invalid credential control characters never reach the upstream', async () => {
  const user = 'sync-injection',
    cmd = start(round(user));
  let called = false;
  const p: LeetcodeProvider = {
    identity: async () => {
      called = true;
      return 'learner';
    },
    page: async () => ({ records: [], hasNext: false, lastKey: '' }),
  };
  await assert.rejects(
    changeLeetcodeSync(user, { ...cmd, session: 'secret; OTHER=cookie' }, p),
  );
  await assert.rejects(
    changeLeetcodeSync(
      user,
      { ...cmd, csrfToken: 'abc\r\nx-secret: value' },
      p,
    ),
  );
  assert.equal(called, false);
});
