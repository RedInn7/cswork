import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-ai-steps-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
process.env.METRICS_DATABASE_PATH = resolve(dir, 'metrics.sqlite');
process.env.CONTENT_DATABASE_PATH = resolve(dir, 'content.sqlite');
process.env.BETTER_AUTH_SECRET = 'x'.repeat(40);
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { PEER_MIN, interviewPeers, issueTicket } = await import('../lib/server/ai-interviewer');
const { library } = await import('../lib/server/content-library');
const { mockSet } = await import('../lib/server/mock-interview');
const { GUIDED_STEPS, KINDS, guideFor, resolveTemplate } = await import('../lib/mock-interview');
const { AI_STEPS } = await import('../lib/mock-ai-interview');

const me: Person = { id: 'st-me', name: 'Me', email: 'st@example.test', role: 'student', verified: true };
let sent: { system: string; messages: { content: unknown }[]; output_config?: { format: { schema: Record<string, unknown> } } }[] = [];
let reply: () => Response;
const realFetch = globalThis.fetch;
const ok = (text: string) => () =>
  Response.json({ stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 100, output_tokens: 20 } });
async function call(action: string, body: unknown, p = me) {
  try {
    const request = new Request(`https://cswork.test/api/oj/ai/${action}`, { method: 'POST', body: JSON.stringify(body) });
    const response = await handleOj(request, p, ['ai', action]);
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  } catch (error) {
    return { status: (error as { status?: number }).status ?? 400, body: { error: (error as Error).message } };
  }
}
const ticket = () => issueTicket(me.id, 'seed1');
const step = (extra: Record<string, unknown> = {}) => ({
  seed: 'seed1',
  ticket: ticket(),
  locale: 'en',
  itemId: 'iq-sd',
  step: 'requirements',
  minutes: 45,
  elapsedSec: 240,
  code: '',
  history: [
    { role: 'candidate', text: 'Who are the users and how many reads per write?' },
    { role: 'interviewer', text: 'Ten million users, mostly reads.' },
  ],
  ...extra,
});
const feedback = JSON.stringify({
  scores: { requirements: 3, communication: 4 },
  keep: 'You asked about the read/write ratio first.',
  fix: 'State a latency target.\n```python\nprint(1)\n```',
});

before(() => {
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
  const content = new Database(process.env.CONTENT_DATABASE_PATH!);
  content.exec(`CREATE TABLE items(id TEXT PRIMARY KEY, type TEXT, slug TEXT, title TEXT, company_slug TEXT, company_name TEXT,
    role TEXT, category TEXT, difficulty TEXT, round TEXT, partial INTEGER, listed INTEGER, dup_of TEXT, extra TEXT, body TEXT)`);
  const insert = content.prepare('INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  insert.run('iq-sd', 'interview_question', 'feed', 'Design a feed', 'acme', 'Acme', 'Software Engineer', 'System Design', null,
    'Onsite', 0, 1, null, '{}', 'Design a news feed. QUESTION-MARKER\n\n## Solution\n\nFan out on write. SOLUTION-MARKER');
  insert.run('iq-fund', 'interview_question', 'tcp', 'TCP vs UDP', 'acme', 'Acme', 'Software Engineer', 'Software Engineering Fundamentals',
    null, 'Onsite', 0, 1, null, '{}', 'Compare TCP and UDP.\n\n## Solution\n\nReliability.');
  content.close();
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    sent.push(JSON.parse(init.body as string));
    return reply();
  }) as typeof fetch;
});
beforeEach(() => {
  sent = [];
  reply = ok(feedback);
  process.env.ANTHROPIC_API_KEY = 'test-key';
  sqlite().prepare('DELETE FROM limits').run();
  sqlite().prepare('DELETE FROM ai_usage').run();
});
after(() => {
  globalThis.fetch = realFetch;
  delete process.env.ANTHROPIC_API_KEY;
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('guides: system design and LLD questions step through five parts; fundamentals and custom mixes do not', () => {
  assert.deepEqual(guideFor('design', 'System Design')?.map((s) => s.id), ['requirements', 'entities', 'api', 'high-level', 'deep-dives']);
  assert.deepEqual(guideFor('lld', null)?.map((s) => s.id), ['clarify', 'classes', 'interfaces', 'code', 'extensibility']);
  assert.equal(guideFor('design', 'Software Engineering Fundamentals'), null);
  assert.equal(guideFor('coding', 'System Design'), null);
  for (const steps of Object.values(GUIDED_STEPS)) assert.equal(steps.length, AI_STEPS);
  assert.equal(resolveTemplate('lld')?.slots[0].kind, 'lld');
  // LLD is AI-only: never in a custom mix.
  assert.equal(KINDS.lld.aiOnly, true);
  assert.equal(resolveTemplate('custom', 'lld.1'), null);
});

void test('a finished step gets scores on its own rubric dimensions, a keep and a fix, without code or the answer key', async () => {
  const { status, body } = await call('interview-step', step());
  assert.equal(status, 200);
  assert.deepEqual(body.feedback, {
    scores: { requirements: 3, communication: 4 },
    keep: 'You asked about the read/write ratio first.',
    fix: 'State a latency target.',
  });
  const [request] = sent;
  assert.deepEqual(request.output_config!.format.schema.required, ['scores', 'keep', 'fix']);
  // A system design step scores the design dimensions, not the coding ones.
  assert.deepEqual((request.output_config!.format.schema.properties as { scores: { required: string[] } }).scores.required, [
    'requirements',
    'communication',
  ]);
  assert.match(request.system, /- requirements: Pins down features, scale/);
  for (const marker of ['QUESTION-MARKER', 'SOLUTION-MARKER', 'Never reveal the reference approach', '"Requirements"'])
    assert.equal(request.system.includes(marker), true, marker);
  assert.match(String(request.messages[0].content), /Candidate: Who are the users/);
  assert.equal(sqlite().prepare("SELECT count FROM ai_usage WHERE kind='iv-call'").pluck().get(), 1);
});

void test('steps are refused before any call: no ticket, no answer yet, not a guided question or step', async () => {
  assert.equal((await call('interview-step', step({ ticket: 'bad.mac' }))).status, 409);
  assert.equal((await call('interview-step', step({ history: [] }))).status, 400);
  assert.equal((await call('interview-step', step({ itemId: 'iq-fund' }))).status, 400);
  assert.equal((await call('interview-step', step({ step: 'classes' }))).status, 400);
  // A turn naming a step outside the question's guide is refused too.
  const turn = { ...step({ step: 'nope' }), ticket: undefined, history: [{ role: 'candidate', text: 'Hi' }] };
  assert.equal((await call('interview', turn)).status, 400);
  assert.equal(sent.length, 0);
});

void test(`a ticket gets ${AI_STEPS} step feedbacks; a failed call hands its step back`, async () => {
  const one = step({ ticket: ticket() });
  reply = () => new Response('{}', { status: 500 });
  assert.equal((await call('interview-step', one)).status, 503);
  reply = ok(feedback);
  for (let i = 0; i < AI_STEPS; i++) {
    sqlite().prepare('DELETE FROM limits').run();
    assert.equal((await call('interview-step', one)).status, 200, `step ${i + 1}`);
  }
  sqlite().prepare('DELETE FROM limits').run();
  const over = await call('interview-step', one);
  assert.equal(over.status, 429);
  assert.equal(over.body.error, '这场面试的分步反馈次数已用完');
});

void test('turns carry the current step to the interviewer', async () => {
  reply = ok('Good. What is the read/write ratio?');
  const turn = { ...step(), history: [{ role: 'candidate', text: 'Let me ask about scale.' }] };
  assert.equal((await call('interview', turn)).status, 200);
  const state = (sent[0].messages[0].content as { text: string }[])[1].text;
  assert.match(state, /current step: Requirements/);
});

void test('LLD: the set carries a statement only, and the interviewer reads the course chapter and the code', async () => {
  const set = mockSet(library()!, new URLSearchParams({ template: 'lld', seed: 'abc' }));
  const [slot] = set.slots;
  assert.equal(slot.kind, 'lld');
  const item = slot.item as { id: string; question: string; solution: string; rubric: string; category: string };
  assert.match(item.id, /^sd-/);
  assert.match(item.question, /^\*\*.+\*\*（.+）\n\nDesign /);
  // Even without parts=question: the reference stays on the server.
  assert.equal(item.solution, '');
  assert.equal(item.rubric, '');
  reply = ok('Which classes do you see?');
  const turn = {
    seed: 'seed1', locale: 'en', itemId: 'sd-lld-parking-lot', minutes: 45, elapsedSec: 60, step: 'classes',
    code: 'class ParkingLot: pass  # LLD-CODE', history: [{ role: 'candidate', text: 'A lot has levels and spots.' }],
  };
  assert.equal((await call('interview', turn)).status, 200);
  const [request] = sent;
  assert.match(request.system, /Low-level design round/);
  assert.match(request.system, /Reference approach, for your judgement only/);
  assert.match((request.messages[0].content as { text: string }[])[1].text, /LLD-CODE/);
  assert.equal((await call('interview', { ...turn, itemId: 'sd-framework' })).status, 404);
});

void test('reports are kept as scores and compared with the best of each other learner, from 30 on', async () => {
  const now = Date.now();
  const insert = sqlite().prepare('INSERT INTO ai_interview_scores(id,user_id,kind,level,scores_json,verdict,created_at) VALUES(?,?,?,?,?,?,?)');
  for (let i = 0; i < PEER_MIN - 1; i++)
    insert.run(`r${i}`, `u${i}`, 'onsite', '', JSON.stringify({ communication: (i % 4) + 1, coding: null }), 'yes', now - 1000);
  assert.equal(interviewPeers(me.id, 'onsite', { communication: 3 }), null);
  // A better second report replaces u0's first; another kind and old rows don't count.
  insert.run('r-best', 'u0', 'onsite', '', JSON.stringify({ communication: 4 }), 'yes', now - 500);
  insert.run('r-kind', 'u-x', 'phone', '', JSON.stringify({ communication: 1 }), 'no', now - 500);
  insert.run('r-old', 'u-y', 'onsite', '', JSON.stringify({ communication: 1 }), 'no', now - 200 * 86_400_000);
  insert.run('r-last', 'u-last', 'onsite', '', JSON.stringify({ communication: 1, coding: 2 }), 'no', now - 500);
  const peers = interviewPeers(me.id, 'onsite', { communication: 3, coding: 4, testing: null })!;
  assert.equal(peers.n, PEER_MIN);
  // communication: u1..u28 cycle 2,3,4,1,…; u0 is 4; u-last is 1. Below 3: the 1s and 2s.
  const comms = [4, ...Array.from({ length: PEER_MIN - 2 }, (_, i) => ((i + 1) % 4) + 1), 1];
  assert.equal(peers.above.communication, Math.round((100 * comms.filter((v) => v < 3).length) / comms.length));
  // Too few others scored coding, and testing was not scored here.
  assert.deepEqual(Object.keys(peers.above), ['communication']);

  reply = ok(
    JSON.stringify({ rubric: { communication: 3, requirements: 3, hld: null, scale: null, tradeoffs: null, deepdive: 2 }, verdict: 'yes', strengths: 'a', improvements: 'b', questions: [] }),
  );
  const t = issueTicket(me.id, 'seed2');
  const questions = [{ itemId: 'iq-sd', minutes: 45, elapsedSec: 600, code: '', history: [{ role: 'candidate', text: 'Fan out on read.' }] }];
  const { status, body } = await call('interview-report', { seed: 'seed2', ticket: t, locale: 'en', questions, template: 'onsite', role: 'swe' });
  assert.equal(status, 200);
  assert.equal((body.peers as { n: number }).n, PEER_MIN);
  const row = sqlite().prepare("SELECT kind,level,scores_json,verdict FROM ai_interview_scores WHERE user_id=?").get(me.id) as Record<string, string>;
  assert.deepEqual({ ...row, scores_json: JSON.parse(row.scores_json) }, {
    kind: 'onsite',
    level: 'swe',
    // A system design question is scored on the design dimensions.
    scores_json: { communication: 3, requirements: 3, hld: null, scale: null, tradeoffs: null, deepdive: 2 },
    verdict: 'yes',
  });
  // An unknown template is not kept.
  const other = await call('interview-report', { seed: 'seed3', ticket: issueTicket(me.id, 'seed3'), locale: 'en', questions, template: 'nope' });
  assert.equal(other.status, 200);
  assert.equal('peers' in other.body, false);
  assert.equal(sqlite().prepare('SELECT COUNT(*) FROM ai_interview_scores WHERE user_id=?').pluck().get(me.id), 1);
});
