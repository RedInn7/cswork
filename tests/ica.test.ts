// CodeSignal ICA-style sets (/oa/ica): the content of every set, its reference solution through all
// four levels and its starting code failing level 1 (run for real when python3 is here), the hidden
// tests a level's run gets (filtered from its problem id, as the worker does), gated runs, and level
// statements that stay closed until the level before them passes.
import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(join(tmpdir(), 'cswork-ica-'));
process.env.DATABASE_PATH = join(dir, 'app.sqlite');
process.env.METRICS_DATABASE_PATH = join(dir, 'metrics.sqlite');
for (const key of ['GO_JUDGE_TOKEN', 'REDIS_URL', 'OJ_ENABLED', 'ANTHROPIC_API_KEY']) delete process.env[key];
process.env.GO_JUDGE_URL = 'http://127.0.0.1:5050';

const { sqlite } = await import('../db/sqlite');
migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
const { icaTasks, icaTask, projectSuite, aiTask } = await import('../lib/server/ai-tasks');
const { ICA_TASK_SLUGS, ICA_LEVELS, PROJECT_PATH, icaProblemId, parseIcaProblemId } = await import('../lib/ai-coding');
const { runProject, projectVerdict } = await import('../lib/server/oj-engine');
const { createProjectRun } = await import('../lib/server/oj-submissions');
const { icaView } = await import('../lib/server/ica');
const { handleOj } = await import('../lib/server/oj-api');

const me: Person = { id: 'ica-me', name: 'Me', email: 'ica-me@example.test', role: 'student', verified: true };
const status = (n: number) => (e: unknown) => (e as { status?: number }).status === n;
const python = spawnSync('python3', ['--version']).status === 0;

// A go-judge stand-in that runs each sandbox with the local python3; it records what each sandbox held.
const sandboxes: string[][] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (_url: string | URL, init: RequestInit) => {
  const {
    cmd: [command],
  } = JSON.parse(init.body as string) as { cmd: { args: string[]; copyIn: Record<string, { content: string }> }[] };
  sandboxes.push(Object.keys(command.copyIn).sort());
  const box = mkdtempSync(join(tmpdir(), 'cswork-ica-box-'));
  try {
    for (const [path, file] of Object.entries(command.copyIn)) {
      mkdirSync(dirname(join(box, path)), { recursive: true });
      writeFileSync(join(box, path), file.content);
    }
    const run = spawnSync('python3', command.args.slice(1), { cwd: box, encoding: 'utf8', timeout: 60_000 });
    return Response.json([
      { status: run.status === 0 ? 'Accepted' : 'Nonzero Exit Status', exitStatus: run.status, time: 2e7, memory: 4 << 20, files: { stdout: run.stdout, stderr: run.stderr } },
    ]);
  } finally {
    rmSync(box, { recursive: true, force: true });
  }
}) as typeof fetch;
after(() => {
  globalThis.fetch = realFetch;
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => {
  sqlite().prepare('DELETE FROM limits').run();
});

/** The files a learner has on level n: the starting code (or the reference) plus levels 1..n's public tests. */
function workspace(slug: string, level: number, solved: boolean) {
  const task = icaTask(slug)!;
  const files: Record<string, string> = Object.assign({}, task.files, ...task.levels.slice(0, level).map((l) => l.tests));
  if (solved) {
    const fixes = join('content/ica', slug, 'solution/src');
    for (const name of readdirSync(fixes)) files[`src/${name}`] = readFileSync(join(fixes, name), 'utf8');
  }
  return files;
}
/** Marks a run finished so the next one is admitted (two at a time per learner). */
const finish = (id: string, result: string) =>
  sqlite().prepare("UPDATE submissions SET status=?,finished_at=? WHERE id=?").run(result, Date.now(), id);

void test('every set ships four bilingual levels, public and hidden tests per level, and starting code within the run limits', () => {
  const tasks = icaTasks();
  assert.deepEqual(tasks.map((t) => t.slug), [...ICA_TASK_SLUGS]);
  for (const task of tasks) {
    assert.ok(task.title.every(Boolean) && task.summary.every(Boolean) && task.minutes === 90, task.slug);
    assert.equal(task.levels.length, ICA_LEVELS);
    assert.ok(Object.keys(task.files).every((path) => PROJECT_PATH.test(path)), task.slug);
    assert.ok('src/__init__.py' in task.files && 'tests/__init__.py' in task.files, task.slug);
    assert.equal(Object.keys(task.files).some((path) => /test_level/.test(path)), false, 'level tests come with their level');
    task.levels.forEach((level, i) => {
      const n = i + 1;
      assert.ok(level.zh.trim() && level.en.trim() && !/^#\s/.test(level.en), `${task.slug} ${n}`);
      assert.ok(/[一-鿿]/.test(level.zh) && !/[一-鿿]/.test(level.en), `${task.slug} ${n} languages`);
      assert.deepEqual(Object.keys(level.tests), [`tests/test_level${n}.py`]);
      assert.deepEqual(Object.keys(level.hidden), [`hidden_tests/test_level${n}.py`]);
      assert.ok(level.hiddenTotal >= 5, `${task.slug} ${n}: ${level.hiddenTotal}`);
    });
  }
  assert.equal(icaTask('nope'), undefined);
});

void test("a level's run gets the hidden tests of levels 1..n only, filtered from its problem id", () => {
  const task = icaTask('bank-ledger')!;
  assert.deepEqual(parseIcaProblemId(icaProblemId('bank-ledger', 2)), { slug: 'bank-ledger', level: 2 });
  assert.equal(parseIcaProblemId('ai-inventory-oversell'), null);
  const suite = projectSuite('ai-ica-bank-ledger-l2')!;
  assert.deepEqual(Object.keys(suite.hidden).sort(), ['hidden_tests/__init__.py', 'hidden_tests/test_level1.py', 'hidden_tests/test_level2.py']);
  assert.equal(suite.hiddenTotal, task.levels[0].hiddenTotal + task.levels[1].hiddenTotal);
  assert.equal(Object.keys(projectSuite('ai-ica-bank-ledger-l4')!.hidden).length, 5);
  assert.equal(projectSuite('ai-ica-bank-ledger-l5'), undefined);
  assert.equal(projectSuite('ai-ica-nope-l1'), undefined);
  // AI-assisted tasks keep their own suite.
  assert.deepEqual(projectSuite('ai-inventory-oversell')?.hidden, aiTask('inventory-oversell')!.hidden);
});

void test('the reference passes all four levels; the starting code fails level 1; hidden tests never reach the public sandbox', { skip: !python && 'python3 missing' }, async () => {
  for (const task of icaTasks()) {
    sandboxes.length = 0;
    const suite = projectSuite(icaProblemId(task.slug, 1))!;
    const before = projectVerdict(...(await runProject(workspace(task.slug, 1, false), suite.hidden, AbortSignal.timeout(120_000))), suite.hiddenTotal);
    assert.equal(before.status, 'wrong_answer', task.slug);
    assert.equal(before.report.hidden.passed, 0, task.slug);
    assert.equal(sandboxes[0].some((path) => path.startsWith('hidden_tests/')), false, task.slug);
    assert.equal(sandboxes[1].some((path) => path.startsWith('tests/')), false, task.slug);
    for (let level = 1; level <= ICA_LEVELS; level++) {
      const { hidden, hiddenTotal } = projectSuite(icaProblemId(task.slug, level))!;
      const verdict = projectVerdict(...(await runProject(workspace(task.slug, level, true), hidden, AbortSignal.timeout(120_000))), hiddenTotal);
      assert.equal(verdict.status, 'accepted', `${task.slug} level ${level}: ${JSON.stringify(verdict.report.visible?.failures)}`);
      assert.deepEqual(verdict.report.hidden, { passed: hiddenTotal, total: hiddenTotal });
      assert.equal(verdict.report.visible!.passed, verdict.report.visible!.total);
    }
  }
});

void test('levels open one at a time; a locked level is neither readable nor runnable', async () => {
  const task = icaTask('kv-ttl-backup')!;
  const view = icaView(null, task.slug)!;
  assert.deepEqual([view.unlocked, view.passed, view.levels.length], [1, [], 1]);
  assert.equal(view.levels[0].hiddenTotal, task.levels[0].hiddenTotal);
  const text = JSON.stringify(view);
  for (const level of task.levels.slice(1)) assert.equal(text.includes(level.en.slice(0, 60)), false);
  for (const level of task.levels) assert.equal(text.includes(Object.values(level.hidden)[0].slice(-80)), false, 'no hidden test');
  assert.equal(icaView(null, 'nope'), null);

  // Signed out through the API: level 1 only.
  const read = (p: Person | null, slug = task.slug) =>
    handleOj(new Request(`https://cswork.test/api/oj/ica/${slug}`), p, ['ica', slug]);
  const response = await read(null);
  assert.equal(response.status, 200);
  assert.deepEqual(((await response.json()) as { levels: unknown[] }).levels.length, 1);
  await assert.rejects(read(null, 'nope'), status(404));

  // Runs: the level must be named with an ica: task and be open.
  const run = (extra: Record<string, unknown>) => ({ task: `ica:${task.slug}`, files: workspace(task.slug, 1, false), idempotencyKey: randomUUID(), ...extra });
  process.env.GO_JUDGE_TOKEN = 'test';
  process.env.REDIS_URL = 'redis://127.0.0.1:6381';
  await assert.rejects(createProjectRun(me, run({})), status(400));
  await assert.rejects(createProjectRun(me, { ...run({ level: 1 }), task: 'inventory-oversell' }), status(400));
  await assert.rejects(createProjectRun(me, run({ task: 'ica:nope', level: 1 })), status(404));
  await assert.rejects(createProjectRun(me, run({ level: 5 })));
  await assert.rejects(createProjectRun(me, run({ level: 2 })), status(403));
  const first = await createProjectRun(me, run({ level: 1 }));
  const row = sqlite().prepare('SELECT problem_id,mode,problem_version_id FROM submissions WHERE id=?').get(first.id);
  assert.deepEqual(row, { problem_id: 'ai-ica-kv-ttl-backup-l1', mode: 'project', problem_version_id: null });
  finish(first.id, 'wrong_answer');
  await assert.rejects(createProjectRun(me, run({ level: 2 })), status(403), 'a failed run opens nothing');

  // An accepted level 1 opens level 2: its brief and public tests, still not level 3.
  finish(first.id, 'accepted');
  const opened = icaView(me.id, task.slug)!;
  assert.deepEqual([opened.unlocked, opened.passed, opened.levels.map((l) => l.level)], [2, [1], [1, 2]]);
  assert.deepEqual(Object.keys(opened.levels[1].tests), ['tests/test_level2.py']);
  assert.equal(opened.levels[1].hiddenTotal, task.levels[0].hiddenTotal + task.levels[1].hiddenTotal);
  const mine = await read(me);
  assert.equal(((await mine.json()) as { unlocked: number }).unlocked, 2);
  const second = await createProjectRun(me, run({ level: 2 }));
  finish(second.id, 'accepted');
  await assert.rejects(createProjectRun(me, run({ level: 4 })), status(403));
  assert.equal(icaView(me.id, task.slug)!.unlocked, 3);
  // Progress is per learner and per set.
  assert.equal(icaView('someone-else', task.slug)!.unlocked, 1);
  assert.equal(icaView(me.id, 'bank-ledger')!.unlocked, 1);
});
