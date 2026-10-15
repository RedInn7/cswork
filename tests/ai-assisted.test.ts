// The AI-assisted round: the practice projects and their suites (run for real when python3 is
// here), project runs on the judge (unlisted, hidden suite as counts only), the AI pair's capped
// context on its own budget, and the companies whose reports mention such rounds.
import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(join(tmpdir(), 'cswork-ai-assisted-'));
process.env.DATABASE_PATH = join(dir, 'app.sqlite');
process.env.METRICS_DATABASE_PATH = join(dir, 'metrics.sqlite');
process.env.CONTENT_DATABASE_PATH = join(dir, 'content.sqlite');
process.env.HIDDEN_COMPANIES = 'hush';
for (const key of ['GO_JUDGE_TOKEN', 'REDIS_URL', 'OJ_ENABLED', 'ANTHROPIC_API_KEY', 'AI_PAIR_DAILY_BUDGET', 'AI_TUTOR_DAILY_BUDGET'])
  delete process.env[key];
process.env.GO_JUDGE_URL = 'http://127.0.0.1:5050';

// Experiences in the content library: two companies mention AI-assisted rounds; the rest must not count.
const content = new Database(process.env.CONTENT_DATABASE_PATH);
content.exec(`CREATE TABLE items(
  id TEXT PRIMARY KEY, type TEXT NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL, summary TEXT,
  company_slug TEXT, company_name TEXT, published_at TEXT, partial INTEGER NOT NULL DEFAULT 0, dup_of TEXT,
  listed INTEGER NOT NULL DEFAULT 1, body TEXT NOT NULL);
  CREATE VIRTUAL TABLE items_fts USING fts5(title, summary, body, content='', tokenize='unicode61');`);
let rowid = 0;
const report = (o: { type?: string; company?: string | null; title: string; summary?: string; body?: string; listed?: number }) => {
  rowid++;
  content
    .prepare(
      'INSERT INTO items(rowid,id,type,slug,title,summary,company_slug,company_name,published_at,listed,body) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
    )
    .run(rowid, `i${rowid}`, o.type ?? 'experience', `exp-${rowid}`, o.title, o.summary ?? '', o.company ?? null,
      o.company ? o.company[0].toUpperCase() + o.company.slice(1) : null, `2026-10-0${rowid % 9}`, o.listed ?? 1, o.body ?? 'body');
  content.prepare('INSERT INTO items_fts(rowid,title,summary,body) VALUES(?,?,?,?)').run(rowid, o.title, o.summary ?? '', o.body ?? 'body');
};
report({ company: 'acme', title: 'Acme onsite', body: 'Round 3 was an AI-assisted coding round in a repo.' });
report({ company: 'acme', title: 'Acme new grad', body: 'They let us use Copilot to extend the service.' });
report({ company: 'beta', title: 'Beta 面经：可以用 AI 的编程轮' });
report({ company: 'gamma', title: 'Gamma backend', body: 'Implement cursor based pagination for the feed.' });
report({ company: 'hush', title: 'Hush onsite', body: 'An AI-enabled round.' });
report({ company: 'delta', title: 'Delta', body: 'AI-assisted round', listed: 0 });
report({ company: null, title: 'Anonymous', body: 'AI-assisted round' });
report({ type: 'interview_question', company: 'zeta', title: 'Zeta question', body: 'AI-assisted round' });
content.close();

const { sqlite } = await import('../db/sqlite');
migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
const { aiTasks, aiTask } = await import('../lib/server/ai-tasks');
const { AI_TASK_SLUGS, PROJECT_PATH, PROJECT_MAX_BYTES } = await import('../lib/ai-coding');
const { runProject, projectVerdict } = await import('../lib/server/oj-engine');
const { createProjectRun, submissionDetail, submissionHistory, cancelSubmission } = await import('../lib/server/oj-submissions');
const { judgeFeed } = await import('../lib/server/judge-feed');
const { aiRoundCompanies, pairContext, PAIR_CONTEXT_CHARS } = await import('../lib/server/ai-rounds');
const { takeQuota, tidyReply, AI_DAILY_LIMITS, today } = await import('../lib/server/ai-tutor');
const { handleOj } = await import('../lib/server/oj-api');

const me: Person = { id: 'aa-me', name: 'Me', email: 'aa-me@example.test', role: 'student', verified: true };
const status = (n: number) => (e: unknown) => (e as { status?: number }).status === n;
const python = spawnSync('python3', ['--version']).status === 0;

// A go-judge stand-in that runs each sandbox with the local python3, one at a time, and an
// Anthropic stand-in that records what the AI pair sends.
const sandboxes: string[][] = [];
let sent: { system: string; max_tokens: number; messages: { role: string; content: string }[] }[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL, init: RequestInit) => {
  if (String(url).includes('api.anthropic.com')) {
    sent.push(JSON.parse(init.body as string));
    return Response.json({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Look at `reserve` in src/inventory.py.' }], usage: { input_tokens: 9000, output_tokens: 400 } });
  }
  const { cmd: [command] } = JSON.parse(init.body as string) as {
    cmd: { args: string[]; copyIn: Record<string, { content: string }> }[];
  };
  sandboxes.push(Object.keys(command.copyIn).sort());
  const box = mkdtempSync(join(tmpdir(), 'cswork-sandbox-'));
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
  sent = [];
  sqlite().prepare('DELETE FROM limits').run();
});

/** The reference fix: solution/src/* over the starting files. */
function solved(slug: string) {
  const task = aiTask(slug)!;
  const fixes = join('content/ai-coding', slug, 'solution/src');
  return { ...task.files, ...Object.fromEntries(readdirSync(fixes).map((name) => [`src/${name}`, readFileSync(join(fixes, name), 'utf8')])) };
}

void test('every task ships its README, starting files and a hidden suite, within the run limits', () => {
  const tasks = aiTasks();
  assert.deepEqual(tasks.map((t) => t.slug), [...AI_TASK_SLUGS]);
  for (const task of tasks) {
    assert.ok(task.readme.en.startsWith('# ') && task.readme.zh.startsWith('# '), task.slug);
    assert.ok(task.title.every(Boolean) && task.summary.every(Boolean) && task.minutes > 0, task.slug);
    assert.ok(Object.keys(task.files).every((path) => PROJECT_PATH.test(path)), task.slug);
    assert.ok('tests/__init__.py' in task.files && 'src/__init__.py' in task.files, task.slug);
    assert.ok(Object.keys(task.hidden).every((path) => path.startsWith('hidden_tests/')), task.slug);
    assert.ok('hidden_tests/__init__.py' in task.hidden && task.hiddenTotal >= 5, task.slug);
    assert.ok(Object.values(task.files).join('').length < PROJECT_MAX_BYTES / 4, task.slug);
  }
});

void test('the verdict shows the public suite and only counts of the hidden one', () => {
  const ok = (report: object | null, stderr = '') => ({ result: { status: 'Accepted', files: { stdout: '', stderr } }, report }) as never;
  const visible = { passed: 3, total: 4, failures: [{ name: 'tests.test_a.T.test_x', message: 'AssertionError: 1 != 2' }] };
  const hiddenFailures = { passed: 5, total: 9, failures: [{ name: 'hidden_tests.test_secret.T.test_y', message: 'secret' }] };
  const v = projectVerdict(ok(visible, 'printed'), ok(hiddenFailures), 9);
  assert.equal(v.status, 'wrong_answer');
  assert.deepEqual([v.passed, v.total], [8, 13]);
  assert.deepEqual(v.report, { visible, hidden: { passed: 5, total: 9 } });
  assert.equal(JSON.stringify(v).includes('secret'), false);
  assert.equal(v.output, 'printed');
  assert.equal(projectVerdict(ok({ ...visible, passed: 4, failures: [] }), ok({ ...hiddenFailures, passed: 9, failures: [] }), 9).status, 'accepted');
  // A hidden suite that never reported still shows its size; a public limit wins over the counts.
  const crashed = projectVerdict(ok(visible), { result: { status: 'Time Limit Exceeded' }, report: null }, 9);
  assert.equal(crashed.status, 'wrong_answer');
  assert.deepEqual(crashed.report.hidden, { passed: 0, total: 9 });
  assert.equal(projectVerdict({ result: { status: 'Memory Limit Exceeded' }, report: null } as never, ok(hiddenFailures), 9).status, 'memory_limit');
  assert.equal(projectVerdict(ok(null), ok(hiddenFailures), 9).status, 'runtime_error');
  // Only the clamped count leaves the hidden sandbox: no time, memory, limit or crash, whatever its report says.
  const allPassed = { passed: 4, total: 4, failures: [] };
  const fast = { result: { status: 'Accepted', time: 2e6, memory: 4096 * 1024, files: {} }, report: allPassed } as never;
  for (const status of ['Memory Limit Exceeded', 'Time Limit Exceeded', 'Nonzero Exit Status', 'Accepted']) {
    const leaky = projectVerdict(fast, { result: { status, time: 9e9, memory: 250 * 1024 ** 2 }, report: status === 'Accepted' ? null : { passed: 9, total: 9, failures: [] } } as never, 9);
    assert.deepEqual([leaky.status, leaky.report.hidden.passed, leaky.runtimeMs, leaky.memoryKb], ['wrong_answer', 0, 2, 4096], status);
  }
  // A forged hidden count stays within 0..the task's own.
  assert.equal(projectVerdict(ok(visible), ok({ passed: 99, total: 99, failures: [] }), 9).report.hidden.passed, 9);
  assert.equal(projectVerdict(ok(visible), ok({ passed: -1e6, total: 9, failures: [] }), 9).report.hidden.passed, 0);
});

void test('starting code fails both suites, the reference fix passes them, hidden tests stay in their own sandbox', { skip: !python && 'python3 missing' }, async () => {
  for (const task of aiTasks()) {
    sandboxes.length = 0;
    const [visible, hidden] = await runProject(task.files, task.hidden, AbortSignal.timeout(120_000));
    // The public sandbox never holds the hidden suite; the hidden one gets src/ only.
    assert.equal(sandboxes[0].some((path) => path.startsWith('hidden_tests/')), false, task.slug);
    assert.equal(sandboxes[1].some((path) => path.startsWith('tests/')), false, task.slug);
    const before = projectVerdict(visible, hidden, task.hiddenTotal);
    assert.equal(before.status, 'wrong_answer', task.slug);
    assert.ok(before.report.visible!.failures.length > 0, task.slug);
    assert.ok(before.report.hidden.passed < task.hiddenTotal, task.slug);
    const after = projectVerdict(...(await runProject(solved(task.slug), task.hidden, AbortSignal.timeout(120_000))), task.hiddenTotal);
    assert.equal(after.status, 'accepted', `${task.slug}: ${JSON.stringify(after.report.visible?.failures)}`);
    assert.deepEqual(after.report.hidden, { passed: task.hiddenTotal, total: task.hiddenTotal }, task.slug);
  }
});

void test('the harness keeps prints out of the report and counts a subTest failure once', { skip: !python && 'python3 missing' }, async () => {
  const files = {
    'src/__init__.py': '',
    'src/noisy.py': 'print("{\\"passed\\": 99, \\"total\\": 99, \\"failures\\": []}")\nVALUE = 1\n',
    'tests/test_noisy.py': [
      'import unittest',
      'from src.noisy import VALUE',
      'class T(unittest.TestCase):',
      '    def test_sub(self):',
      '        for i in range(5):',
      '            with self.subTest(i=i):',
      '                self.assertEqual(VALUE, 2)',
      '    def test_ok(self):',
      '        self.assertEqual(VALUE, 1)',
      '    @unittest.skip("later")',
      '    def test_later(self):',
      '        pass',
      '',
    ].join('\n'),
  };
  // tests/__init__.py is missing on purpose: the harness adds it.
  const [visible] = await runProject(files, { 'hidden_tests/test_none.py': '' }, AbortSignal.timeout(60_000));
  assert.deepEqual([visible.report?.passed, visible.report?.total], [1, 3]);
  assert.deepEqual(visible.report?.failures.map((f) => f.name), ['tests.test_noisy.T.test_sub']);
  assert.match(visible.result.files!.stderr, /"passed": 99/);
});

void test('a project run is validated, queued without a problem version and kept out of history', async () => {
  const task = aiTask('inventory-oversell')!;
  const run = (extra: Record<string, unknown> = {}) => ({ task: task.slug, files: task.files, idempotencyKey: randomUUID(), ...extra });
  await assert.rejects(createProjectRun(me, run()), status(503));
  process.env.GO_JUDGE_TOKEN = 'test';
  process.env.REDIS_URL = 'redis://127.0.0.1:6381';
  await assert.rejects(createProjectRun(me, run({ task: 'no-such-task' })), status(404));
  for (const path of ['hidden_tests/test_contract.py', '../x.py', 'src/a.txt', 'src/sub/a.py', 'README.md'])
    await assert.rejects(createProjectRun(me, run({ files: { ...task.files, [path]: 'x' } })));
  const many = Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`src/m${i}.py`, '']));
  await assert.rejects(createProjectRun(me, run({ files: many })), status(413));
  const big = Object.fromEntries(Array.from({ length: 3 }, (_, i) => [`src/big${i}.py`, '#'.repeat(100_000)]));
  await assert.rejects(createProjectRun(me, run({ files: big })), status(413));
  await assert.rejects(createProjectRun(me, run({ files: {} })), status(413));
  await assert.rejects(createProjectRun(me, run({ files: { 'src/a.py': 'a\0b' } })), status(400));
  await assert.rejects(createProjectRun({ ...me, verified: false }, run()), status(403));

  const input = run();
  const created = await createProjectRun(me, input);
  assert.deepEqual(await createProjectRun(me, input), created);
  await assert.rejects(createProjectRun(me, { ...input, files: { ...task.files, 'src/x.py': '' } }), status(409));
  const row = sqlite().prepare('SELECT * FROM submissions WHERE id=?').get(created.id) as Record<string, unknown>;
  assert.equal(row.mode, 'project');
  assert.equal(row.problem_id, 'ai-inventory-oversell');
  assert.equal(row.problem_version_id, null);
  assert.equal(row.language, 'python');
  assert.deepEqual(JSON.parse(row.code as string).files, task.files);
  assert.equal(JSON.stringify(row).includes('test_double_release'), false);
  assert.equal((await submissionDetail(me, created.id)).project, null);

  // As the worker leaves it: one result row with the report.
  const reportJson = { visible: { passed: 3, total: 4, failures: [{ name: 'tests.test_inventory.InventoryTest.test_cannot_reserve_units_already_held', message: 'AssertionError: OutOfStock not raised' }] }, hidden: { passed: 2, total: task.hiddenTotal } };
  sqlite()
    .prepare("UPDATE submissions SET status='wrong_answer',passed=5,total=?,finished_at=? WHERE id=?")
    .run(4 + task.hiddenTotal, Date.now(), created.id);
  sqlite()
    .prepare("INSERT INTO oj_results(submission_id,ordinal,status,runtime_ms,memory_kb,stdout,stderr,hidden) VALUES(?,0,'wrong_answer',20,4096,?,'debug print',0)")
    .run(created.id, JSON.stringify(reportJson));
  const detail = await submissionDetail(me, created.id);
  assert.deepEqual(detail.project, { ...reportJson, output: 'debug print' });
  assert.deepEqual(detail.cases, []);
  assert.equal(submissionHistory(me, null, null).items.length, 0);
  assert.equal(submissionHistory(me, 'ai-inventory-oversell', null).items.length, 0);
  assert.equal(judgeFeed(me, new URLSearchParams({ mine: '1' })).items.length, 0);

  // Through the API: the reply is the run's detail.
  const response = await handleOj(
    new Request('https://cswork.test/api/oj/ai-assisted/run', { method: 'POST', body: JSON.stringify(run()) }),
    me,
    ['ai-assisted', 'run'],
  );
  assert.equal(response.status, 201);
  const queued = (await response.json()) as { id: string; mode: string; status: string };
  assert.deepEqual([queued.mode, queued.status], ['project', 'queued']);
  await cancelSubmission(me, queued.id);
});

void test('the AI pair is off without a key, sends a capped context with the last run, and has its own budget', async () => {
  const task = aiTask('inventory-oversell')!;
  const ask = (body: Record<string, unknown>, p = me) =>
    handleOj(
      new Request('https://cswork.test/api/oj/ai/pair', { method: 'POST', body: JSON.stringify({ task: task.slug, files: task.files, question: 'Why does test_x fail?', ...body }) }),
      p,
      ['ai', 'pair'],
    );
  await assert.rejects(ask({}), status(404));
  process.env.ANTHROPIC_API_KEY = 'test-key';
  await assert.rejects(ask({ task: 'nope' }), status(404));
  await assert.rejects(ask({ question: '  ' }), status(400));
  // A run's limits: thousands of empty files cannot widen the prompt with their names.
  await assert.rejects(ask({ files: Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`src/m${i}.py`, ''])) }), status(413));
  await assert.rejects(ask({ files: { 'src/big.py': '#'.repeat(PROJECT_MAX_BYTES + 1) } }), status(413));

  // A large project: the open file goes first, the rest only while they fit.
  const files = { ...task.files, 'src/huge.py': 'x = 1\n'.repeat(5000), 'src/zz_extra.py': 'y = 2\n'.repeat(1000) };
  const history = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `turn ${i} ` + 'w'.repeat(1500) }));
  const response = await ask({ files, active: 'src/inventory.py', history, locale: 'zh' });
  assert.equal(response.status, 200);
  const reply = (await response.json()) as { text: string; remaining: number; limit: number };
  assert.equal(reply.limit, AI_DAILY_LIMITS.pair);
  assert.equal(reply.remaining, AI_DAILY_LIMITS.pair - 1);
  const call = sent[0];
  assert.equal(call.system.includes('AI pair programmer'), true);
  assert.ok(call.system.includes('each at most 60 lines and 120 lines in all'), 'the code caps tidyReply enforces');
  assert.ok(call.max_tokens <= 4096);
  const prompt = call.messages.map((m) => m.content).join('\n');
  assert.ok(prompt.length <= PAIR_CONTEXT_CHARS + 200, String(prompt.length));
  assert.equal(call.messages[0].role, 'user');
  assert.equal(call.messages.at(-1)!.content, 'Why does test_x fail?');
  assert.ok(call.messages[0].content.includes('<file path="src/inventory.py">'));
  assert.ok(call.messages[0].content.includes('src/huge.py'), 'named although not sent');
  assert.equal(call.messages[0].content.includes('<file path="src/huge.py">'), false);
  assert.ok(call.messages[0].content.includes('Simplified Chinese'));
  assert.ok(call.messages[0].content.includes('库存服务'), 'the Chinese README');
  // The last run's public failures and the hidden suite's counts, never a hidden test.
  assert.ok(call.messages[0].content.includes('Public tests: 3/4 passed.'));
  assert.ok(call.messages[0].content.includes('test_cannot_reserve_units_already_held'));
  assert.ok(call.messages[0].content.includes(`Hidden tests: 2/${task.hiddenTotal} passed`));
  for (const name of Object.values(task.hidden).join('').match(/def (test_\w+)/g)!)
    assert.equal(prompt.includes(name.slice(4)), false, name);
  // Nothing of the project is stored.
  assert.equal(JSON.stringify(sqlite().prepare("SELECT * FROM ai_usage WHERE kind='pair'").all()).includes('inventory'), false);

  // Its own pool: a spent pair budget leaves the tutor's alone, and the other way round.
  sqlite().prepare('DELETE FROM limits').run();
  process.env.AI_PAIR_DAILY_BUDGET = '1';
  await assert.rejects(ask({}), status(503));
  process.env.AI_TUTOR_DAILY_BUDGET = '1';
  assert.equal(takeQuota(me.id, 'hint', today(), AI_DAILY_LIMITS.hint, 'x'), AI_DAILY_LIMITS.hint - 1);
  await assert.rejects(Promise.resolve().then(() => takeQuota(me.id, 'hint', today(), AI_DAILY_LIMITS.hint, 'x')), status(503));
  delete process.env.AI_PAIR_DAILY_BUDGET;
  delete process.env.AI_TUTOR_DAILY_BUDGET;
  sqlite().prepare("UPDATE ai_usage SET count=? WHERE kind='pair'").run(AI_DAILY_LIMITS.pair);
  await assert.rejects(ask({}), status(429));
  sqlite().prepare("DELETE FROM ai_usage WHERE kind='pair'").run();

  // Never while a contest runs for this learner.
  const now = Date.now();
  sqlite()
    .prepare(
      `INSERT INTO contest_rooms(id,owner_id,title,kind,problem_ids_json,starts_at,duration_min,visibility,created_at)
       VALUES('aa-room',NULL,'Mashup','mashup','["lc-1"]',?,60,'private',?)`,
    )
    .run(now - 60_000, now - 60_000);
  sqlite().prepare("INSERT INTO contest_entries(room_id,user_id,display_name,joined_at) VALUES('aa-room',?,'Me',?)").run(me.id, now);
  await assert.rejects(ask({}), status(403));
  delete process.env.ANTHROPIC_API_KEY;
});

void test('a pair reply within its stated caps comes back whole', () => {
  const block = (name: string) => ['```python', ...Array.from({ length: 60 }, (_, i) => `    ${name}_${i} = compute(${name}, ${i})  # line ${i}`.padEnd(50, '.')), '```'].join('\n');
  const prose = Array.from({ length: 150 }, (_, i) => `word${i} other`).join(' ');
  const reply = `${prose}\n\n${block('a')}\n\nIn src/b.py:\n\n${block('b')}`;
  assert.equal(tidyReply(reply, 'pair'), reply);
  // A third 60-line block is past the 120 lines in all.
  assert.equal(tidyReply(`${reply}\n\n${block('c')}`, 'pair'), reply);
});

void test("the names of the files left out count toward the pair's budget", () => {
  const crowd = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`src/${'n'.repeat(55)}${String(i).padStart(2, '0')}.py`, 'z'.repeat(1500)]));
  const context = pairContext('readme', 'No test run yet.', crowd, undefined, 12_000);
  assert.ok(context.length <= 12_000, String(context.length));
  assert.ok(context.includes(`${'n'.repeat(55)}29.py</files_not_shown>`));
});

void test('companies whose public experiences mention AI-assisted rounds, hidden ones left out', () => {
  const found = aiRoundCompanies();
  assert.deepEqual(found.map((c) => [c.slug, c.reports]), [['acme', 2], ['beta', 1]]);
  assert.equal(found[0].name, 'Acme');
  assert.deepEqual(found[0].links.map((l) => l.path).sort(), ['/library/experience/exp-1', '/library/experience/exp-2']);
});
