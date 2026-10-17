import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
import type { OjProblemPackage } from '../lib/oj-types';
import { explainQuery } from '../lib/sql-cte';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-sql-peek-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
// Rows and outbox entries only: no worker, runner or Redis is contacted.
process.env.OJ_ENABLED = 'true';
const { sqlite } = await import('../db/sqlite');
const { saveProblemDraft, publishProblemDraft } = await import('../lib/server/oj-problems');
const { createSubmission, cancelSubmission, formalMode } = await import('../lib/server/oj-submissions');
const { handleOj } = await import('../lib/server/oj-api');

const me: Person = { id: 'peek-me', name: 'Me', email: 'peek@example.test', role: 'student', verified: true };
const teacher: Person = { ...me, id: 'peek-teacher', role: 'teacher' };
const pkg = (JSON.parse(readFileSync('content/sql-track/packages.json', 'utf8')) as OjProblemPackage[])[0];
const sample = pkg.cases.find((c) => !c.hidden)!.input;

function call(p: Person, method: string, path: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/oj/${path}`);
  return handleOj(
    new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) }),
    p,
    url.pathname.split('/').slice(3),
  );
}
async function status(p: Person, method: string, path: string, body?: unknown) {
  try {
    return (await call(p, method, path, body)).status;
  } catch (error) {
    return (error as { status?: number }).status ?? 400;
  }
}
const peek = (extra: object = {}) => ({
  problemId: pkg.problem.id,
  language: 'sql',
  code: explainQuery('SELECT * FROM employees'),
  mode: 'sql-peek',
  stdin: sample,
  idempotencyKey: randomUUID(),
  ...extra,
});

before(async () => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  db.prepare("INSERT INTO courses(id,title,summary,version,published) VALUES('gomall','Test','Test','1',1)").run();
  db.prepare(
    "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES('00-overview','gomall','Test','','test',0,'','1',0)",
  ).run();
  await publishProblemDraft(teacher, pkg.problem.id, (await saveProblemDraft(teacher, pkg, null)).draft!.revision);
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('a SQL peek is an unlisted run on the learner’s own dataset, on SQL only', async () => {
  // Without stdin it would judge the hidden cases and leave no attempt; other languages have no peek.
  assert.equal(await status(me, 'POST', 'submissions', peek({ stdin: undefined })), 400);
  assert.equal(await status(me, 'POST', 'submissions', peek({ problemId: 'lc-1', language: 'python', code: 'print(1)' })), 400);
  assert.equal(await status(me, 'POST', 'submissions', peek({ language: 'pandas' })), 400);
  const created = (await (await call(me, 'POST', 'submissions', peek())).json()) as { id: string; mode: string; total: number };
  assert.equal(created.mode, 'run', 'the page reads it as a run');
  assert.equal(created.total, 1, 'its one custom input');
  const row = sqlite().prepare('SELECT mode,custom_input FROM submissions WHERE id=?').get(created.id) as { mode: string; custom_input: string };
  assert.equal(row.mode, 'sql-peek');
  assert.equal(row.custom_input, sample);
  assert.equal(formalMode(row.mode), false);
  const detail = (await (await call(me, 'GET', `submissions/${created.id}`)).json()) as { mode: string; cases: { stdin?: string }[] };
  assert.equal(detail.mode, 'run');
  assert.deepEqual(detail.cases.map((c) => c.stdin), [sample], 'only its own input, no hidden case');
  const history = (await (await call(me, 'GET', `submissions?problemId=${pkg.problem.id}`)).json()) as { items: { id: string }[] };
  assert.ok(!history.items.some((item) => item.id === created.id), 'peeks stay out of the submission list');
  await cancelSubmission(me, created.id);
});

void test('peeks have their own 20 a minute, apart from the 12 runs', async (t) => {
  // One rate window: the limit key is per minute.
  const now = Date.now();
  t.mock.method(Date, 'now', () => now);
  const other: Person = { ...me, id: 'peek-limit' };
  for (let k = 0; k < 20; k++) await cancelSubmission(other, (await createSubmission(other, peek())).id);
  await assert.rejects(createSubmission(other, peek()), (error: { status?: number }) => error.status === 429);
  const run = await createSubmission(other, { ...peek(), mode: 'run', code: 'SELECT 1' });
  assert.equal(run.status, 'queued');
});
