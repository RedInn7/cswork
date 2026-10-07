/** Built-server integration, isolated SQLite/session fixtures, upstream network denied. */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID, createHmac } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const entry = resolve(
  process.env.TEST_WEB_ENTRY || 'dist/standalone/server.js',
);
const base = 'http://127.0.0.1:4324';
const dir = mkdtempSync(join(tmpdir(), 'cswork-leetcode-http-'));
const file = join(dir, 'test.sqlite');
const blocked = join(dir, 'external-request-attempt');
const preload = join(dir, 'deny-upstream.cjs');
const secret = randomUUID() + randomUUID();
const db = new Database(file);
let server;
let logs = '';
try {
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  writeFileSync(
    preload,
    `const fs=require('node:fs'); globalThis.fetch=async()=>{fs.writeFileSync(${JSON.stringify(blocked)},'attempt');throw new Error('External requests forbidden in HTTP fixture');};`,
  );
  const now = Date.now();
  function user(name) {
    const id = randomUUID(),
      token = randomUUID();
    db.prepare(
      'INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,?,?,?)',
    ).run(id, name, `${name}@example.test`, 1, now, now);
    db.prepare(
      'INSERT INTO session(id,expires_at,token,created_at,updated_at,user_id) VALUES(?,?,?,?,?,?)',
    ).run(randomUUID(), now + 3600000, token, now, now, id);
    const signature = createHmac('sha256', secret)
      .update(token)
      .digest('base64');
    return {
      id,
      cookie: `better-auth.session_token=${encodeURIComponent(token + '.' + signature)}`,
    };
  }
  const alice = user('sync-alice'),
    bob = user('sync-bob');
  server = spawn(process.execPath, ['--require', preload, entry], {
    cwd: dirname(entry),
    env: {
      PATH: process.env.PATH,
      NODE_ENV: 'production',
      NODE_OPTIONS: '--max-old-space-size=1024',
      HOST: '127.0.0.1',
      PORT: '4324',
      APP_URL: base,
      BETTER_AUTH_SECRET: secret,
      DATABASE_PATH: file,
      OJ_ENABLED: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const stream of [server.stdout, server.stderr])
    stream.on('data', (chunk) => {
      logs = (logs + chunk).slice(-8000);
    });
  let ready = false;
  for (const deadline = Date.now() + 30000; Date.now() < deadline;) {
    assert(
      server.exitCode === null && server.signalCode === null,
      'Server exited: ' + logs,
    );
    try {
      if ((await fetch(base + '/api/bootstrap')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(200);
  }
  assert(ready, 'Server unavailable: ' + logs);
  let checks = 0;
  async function request(
    path,
    { person = alice, data, status = 200, origin = base } = {},
  ) {
    const response = await fetch(base + '/api/oj/' + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: {
        ...(person ? { cookie: person.cookie } : {}),
        ...(data !== undefined
          ? {
              'Content-Type': 'application/json',
              ...(origin ? { Origin: origin } : {}),
            }
          : {}),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const payload = await response.json();
    assert.equal(
      response.status,
      status,
      `${path}: ${JSON.stringify(payload)}`,
    );
    assert.equal(response.headers.get('cache-control'), 'no-store');
    checks++;
    return payload;
  }
  await request('leetcode-sync', { person: null, status: 401 });
  await request('leetcode-sync', {
    data: { action: 'cancel', runId: randomUUID() },
    origin: 'https://attacker.test',
    status: 403,
  });
  await request('leetcode-sync', {
    data: { action: 'cancel', runId: randomUUID() },
    origin: null,
    status: 403,
  });
  const first = await request('practice-rounds'),
    other = await request('practice-rounds', { person: bob });
  const valid = {
    action: 'start',
    region: 'cn',
    roundId: first.activeRoundId,
    idempotencyKey: randomUUID(),
    session: 'synthetic-session',
    csrfToken: 'syntheticcsrf',
  };
  await request('leetcode-sync', {
    data: { ...valid, roundId: other.activeRoundId },
    status: 404,
  });
  await request('leetcode-sync', {
    data: { ...valid, session: 'secret\r\nInjected: yes' },
    status: 400,
  });
  await request('leetcode-sync', {
    data: {
      action: 'continue',
      runId: randomUUID(),
      session: 'synthetic-session',
      csrfToken: 'syntheticcsrf',
    },
    status: 404,
  });
  db.prepare(
    `INSERT INTO study_library(id,number,slug,title_zh,title_en,difficulty,topics_json,payload_json,content_hash,case_count,expected_count,judge_problem_id,imported_at) VALUES('lc-1',1,'two-sum','两数之和','Two Sum','Easy','[]','{}','source',0,0,'lc-1',0)`,
  ).run();
  function imported(person, round, region, slug = 'two-sum') {
    const id = randomUUID();
    db.prepare(
      `INSERT INTO leetcode_accepted_records(id,user_id,region,external_username,external_submission_id,slug,title,language,submitted_at,source_url,imported_at) VALUES(?,?,?,?,?,?,'Two Sum','python3',?,?,?)`,
    ).run(
      id,
      person.id,
      region,
      'fixture-owner',
      '123',
      slug,
      now,
      `https://${region === 'cn' ? 'leetcode.cn' : 'leetcode.com'}/submissions/detail/123/`,
      now,
    );
    db.prepare(
      'INSERT INTO leetcode_round_records(user_id,round_id,record_id,created_at) VALUES(?,?,?,?)',
    ).run(person.id, round, id, now);
  }
  imported(alice, first.activeRoundId, 'cn');
  imported(alice, first.activeRoundId, 'us');
  imported(bob, other.activeRoundId, 'cn');
  const runId = randomUUID();
  db.prepare(
    `INSERT INTO leetcode_sync_runs(id,user_id,region,external_username,round_id,status,idempotency_key,created_at,updated_at) VALUES(?,?,'cn','fixture-owner',?,'cancelled',?,?,?)`,
  ).run(runId, bob.id, other.activeRoundId, randomUUID(), now, now);
  await request('leetcode-sync', {
    data: { action: 'cancel', runId },
    status: 404,
  });
  await request('leetcode-sync', {
    data: {
      action: 'continue',
      runId,
      session: 'synthetic-session',
      csrfToken: 'syntheticcsrf',
    },
    status: 404,
  });
  const state = await request('leetcode-sync');
  assert.equal(state.total, 2);
  assert.equal(state.runs.length, 0);
  assert.deepEqual(state.summary, { accepted: 2, matched: 2, unmatched: 0 });
  assert(
    !JSON.stringify(state).match(
      /synthetic|"(?:csrfToken|session|code|idempotencyKey|lastKey)"/i,
    ),
    'GET exposes only safe metadata',
  );
  const library = await request('library?collection=ling-selected-500');
  assert.equal(library.collection.solved, 1);
  assert.equal(library.collection.ready, 0);
  assert.deepEqual(library.items[0].importedSources, ['cn', 'us']);
  assert.equal(library.items[0].solvedLocally, false);
  assert.equal(library.items[0].judgeProblemId, null);
  const next = await request('practice-rounds', {
    data: { action: 'create', idempotencyKey: randomUUID() },
  });
  assert.equal(next.currentRound.number, 2);
  assert.equal(next.rounds[0].solved, 1);
  assert.equal(next.rounds[1].solved, 0);
  assert.equal(
    (await request('library?collection=ling-selected-500')).collection.solved,
    0,
  );
  assert.equal(
    (await request('leetcode-sync')).total,
    2,
    'new round retains imported history',
  );
  await request('practice-rounds', {
    data: { action: 'activate', roundId: first.activeRoundId },
  });
  assert.equal(
    (await request('library?collection=ling-selected-500')).collection.solved,
    1,
  );
  assert.equal(
    db.prepare('SELECT COUNT(*) n FROM submissions').get().n,
    0,
    'external records never forge judge submissions',
  );
  assert.equal(
    existsSync(blocked),
    false,
    'all invalid requests rejected before contacting upstream',
  );
  assert(
    !logs.includes('synthetic-session') && !logs.includes('Injected:'),
    'logs must not contain credentials',
  );
  console.log(
    JSON.stringify({
      event: 'leetcode_sync_http_complete',
      checks,
      anonymousDenied: true,
      csrfDenied: true,
      upstreamRequests: 0,
      roundIsolation: true,
      historyPreserved: true,
    }),
  );
} finally {
  if (server && server.exitCode === null && server.signalCode === null) {
    const exited = new Promise((resolveExit) =>
      server.once('exit', resolveExit),
    );
    server.kill('SIGTERM');
    await Promise.race([exited, delay(10000)]);
    if (server.exitCode === null && server.signalCode === null) {
      server.kill('SIGKILL');
      await exited;
    }
  }
  db.close();
  rmSync(dir, { recursive: true, force: true });
}
