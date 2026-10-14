import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-ai-interviewer-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
process.env.METRICS_DATABASE_PATH = resolve(dir, 'metrics.sqlite');
process.env.CONTENT_DATABASE_PATH = resolve(dir, 'content.sqlite');
process.env.BETTER_AUTH_SECRET = 'x'.repeat(40);
process.env.HIDDEN_COMPANIES = 'secretco';
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { INTERVIEW_LIMITS, issueTicket, validTicket } = await import('../lib/server/ai-interviewer');
const { AI_TURNS, reportFeedback } = await import('../lib/mock-ai-interview');
const { decodeFeedback, encodeFeedback, questionTag } = await import('../lib/mock-interview-feedback');

const me: Person = { id: 'iv-me', name: 'Me', email: 'iv@example.test', role: 'student', verified: true };
const other: Person = { ...me, id: 'iv-other', email: 'iv-other@example.test' };
const CODING = 'Coding & Algorithms';

type Sent = { headers: Record<string, string>; body: Record<string, unknown> };
let sent: Sent[] = [];
let reply: () => Response;
const realFetch = globalThis.fetch;
const ok = (text: string) => () =>
  Response.json({
    stop_reason: 'end_turn',
    content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }],
    usage: { input_tokens: 900, output_tokens: 60 },
  });

async function call(p: Person, action: string, body: unknown) {
  try {
    const request = new Request(`https://cswork.test/api/oj/ai/${action}`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await handleOj(request, p, ['ai', action]);
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  } catch (error) {
    return { status: (error as { status?: number }).status ?? 400, body: { error: (error as Error).message } };
  }
}
const used = (user: string, kind: string) =>
  (sqlite().prepare('SELECT count FROM ai_usage WHERE user_id=? AND kind=?').pluck().get(user, kind) as number | undefined) ?? 0;
const turn = (extra: Record<string, unknown> = {}) => ({
  seed: 'abc123',
  locale: 'en',
  itemId: 'cq-sum',
  minutes: 25,
  elapsedSec: 300,
  code: 'def solve(): return 42  # MY-CODE-MARKER',
  history: [{ role: 'candidate', text: 'Can the input be empty?' }],
  ...extra,
});

before(() => {
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
  const content = new Database(process.env.CONTENT_DATABASE_PATH!);
  content.exec(`CREATE TABLE items(id TEXT PRIMARY KEY, type TEXT, slug TEXT, title TEXT, company_slug TEXT, company_name TEXT,
    role TEXT, category TEXT, difficulty TEXT, round TEXT, partial INTEGER, listed INTEGER, dup_of TEXT, extra TEXT, body TEXT)`);
  const insert = content.prepare('INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const body = `Add two numbers. QUESTION-MARKER\n\n### Hints\n\nUse plus. HINT-MARKER\n\n## Solution\n\nReturn a + b. SOLUTION-MARKER`;
  insert.run('cq-sum', 'coding_question', 'sum', 'Sum two', 'acme', 'Acme', 'Software Engineer', CODING, 'easy', 'Onsite', 0, 1, null, '{}', body);
  insert.run('iq-bq', 'interview_question', 'bq', 'A conflict', 'acme', 'Acme', 'Software Engineer', 'Behavioral & Leadership',
    null, 'Onsite', 0, 1, null, '{}', 'Tell me about a conflict.\n\n## Solution\n\nSTAR.');
  insert.run('cq-partial', 'coding_question', 'p', 'Partial', 'acme', 'Acme', null, CODING, 'easy', null, 1, 1, null, '{}', 'x');
  insert.run('cq-hidden', 'coding_question', 'h', 'Hidden', 'secretco', 'Secret', null, CODING, 'easy', null, 0, 1, null, '{}', 'x');
  content.close();
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    sent.push({ headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
    return reply();
  }) as typeof fetch;
});
beforeEach(() => {
  sent = [];
  reply = ok('Good question. What would you return then?\n```python\nreturn 0\n```');
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

void test('off without ANTHROPIC_API_KEY', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  assert.equal((await call(me, 'interview', turn())).status, 404);
  assert.equal(sent.length, 0);
});

void test('the first message opens an interview: the notes stay on the server, the code and clock ride after the cache breakpoint', async () => {
  const { status, body } = await call(me, 'interview', turn());
  assert.equal(status, 200);
  assert.equal(typeof body.ticket === 'string' && validTicket(body.ticket, me.id, 'abc123'), true);
  assert.equal(body.interviewsLeft, INTERVIEW_LIMITS.interviews - 1);
  // An interviewer never writes code: the hint rules strip it.
  assert.equal(String(body.text).includes('return 0'), false);
  assert.equal(String(body.text).startsWith('Good question.'), true);
  assert.equal(used(me.id, 'interview'), 1);
  assert.equal(used(me.id, 'interview-call'), 1);
  const [{ headers, body: request }] = sent;
  assert.equal(request.model, 'claude-opus-5-5');
  assert.equal(request.fallbacks, 'default');
  assert.equal(headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  const system = String(request.system);
  for (const marker of ['QUESTION-MARKER', 'HINT-MARKER', 'SOLUTION-MARKER', 'Never reveal the reference approach', 'Reply in English.'])
    assert.equal(system.includes(marker), true, marker);
  const messages = request.messages as { role: string; content: { type: string; text: string; cache_control?: unknown }[] }[];
  assert.equal(messages.length, 1);
  const [said, state] = messages[0].content;
  assert.equal(said.text, 'Can the input be empty?');
  assert.deepEqual(said.cache_control, { type: 'ephemeral' });
  assert.equal(state.text.includes('MY-CODE-MARKER'), true);
  assert.equal(state.text.includes('5 of 25 planned minutes used'), true);
});

void test('later turns carry the ticket: no second interview, and a ticket only works for its learner and set', async () => {
  const ticket = issueTicket(me.id, 'abc123');
  const history = [
    { role: 'candidate', text: 'Can the input be empty?' },
    { role: 'interviewer', text: 'No.' },
    { role: 'candidate', text: 'Then I add them.' },
  ];
  const { status, body } = await call(me, 'interview', turn({ ticket, history, locale: 'zh' }));
  assert.equal(status, 200);
  assert.equal('interviewsLeft' in body, false);
  assert.equal(used(me.id, 'interview'), 0);
  const request = sent[0].body;
  assert.equal(String(request.system).includes('Simplified Chinese'), true);
  const roles = (request.messages as { role: string }[]).map((m) => m.role);
  assert.deepEqual(roles, ['user', 'assistant', 'user']);
  assert.equal((await call(other, 'interview', turn({ ticket }))).status, 409);
  assert.equal((await call(me, 'interview', turn({ ticket, seed: 'zzz' }))).status, 409);
  assert.equal((await call(me, 'interview', turn({ ticket: `${Date.now() - 1}.${ticket.split('.')[1]}` }))).status, 409);
  assert.equal(sent.length, 1);
});

void test('bad transcripts and questions outside the pool are refused before any call', async () => {
  const many = Array.from({ length: AI_TURNS + 1 }, () => ({ role: 'candidate', text: 'hi' }));
  assert.equal((await call(me, 'interview', turn({ history: many }))).status, 409);
  assert.equal((await call(me, 'interview', turn({ history: [] }))).status, 400);
  assert.equal(
    (await call(me, 'interview', turn({ history: [{ role: 'candidate', text: 'a' }, { role: 'interviewer', text: 'b' }] }))).status,
    400,
  );
  assert.equal((await call(me, 'interview', turn({ history: [{ role: 'candidate', text: '   ' }] }))).status, 400);
  for (const itemId of ['cq-partial', 'cq-hidden', 'nope'])
    assert.equal((await call(me, 'interview', turn({ itemId }))).status, 404, itemId);
  assert.equal(sent.length, 0);
  assert.equal(used(me.id, 'interview-call'), 0);
});

void test('three interviews a day; a refused fourth hands its call back, and an unbilled failure hands both back', async () => {
  for (let i = 0; i < INTERVIEW_LIMITS.interviews; i++) assert.equal((await call(me, 'interview', turn())).status, 200);
  const fourth = await call(me, 'interview', turn());
  assert.equal(fourth.status, 429);
  assert.equal(fourth.body.error, '今天的 AI 模拟面试次数已用完，明天再来');
  assert.equal(used(me.id, 'interview-call'), INTERVIEW_LIMITS.interviews);
  sqlite().prepare('DELETE FROM ai_usage').run();
  reply = () => new Response('{}', { status: 500 });
  assert.equal((await call(me, 'interview', turn())).status, 503);
  assert.equal(used(me.id, 'interview'), 0);
  assert.equal(used(me.id, 'interview-call'), 0);
});

void test('the report: ticket required, JSON schema output, one entry per question, AI feedback that survives a link', async () => {
  const ticket = issueTicket(me.id, 'abc123');
  const q = (itemId: string, history: unknown[]) => ({ itemId, minutes: 20, elapsedSec: 600, code: '', history });
  const questions = [q('cq-sum', [{ role: 'candidate', text: 'I add them.' }, { role: 'interviewer', text: 'Complexity?' }]), q('iq-bq', [])];
  assert.equal((await call(me, 'interview-report', { seed: 'abc123', ticket: 'bad.mac', locale: 'en', questions })).status, 409);
  assert.equal(
    (await call(me, 'interview-report', { seed: 'abc123', ticket, locale: 'en', questions: [q('iq-bq', [])] })).status,
    400,
  );
  reply = ok(
    JSON.stringify({
      rubric: { communication: 3, problem: 2, coding: 4, testing: null, complexity: 1 },
      verdict: 'yes',
      strengths: 'Clear.',
      improvements: 'Test more.',
      questions: [{ rating: 3, note: 'Solid.' }],
    }),
  );
  const { status, body } = await call(me, 'interview-report', { seed: 'abc123', ticket, locale: 'en', questions });
  assert.equal(status, 200);
  const report = body.report as Parameters<typeof reportFeedback>[0];
  assert.equal(report.questions.length, 2);
  assert.equal(report.questions[1].rating, null);
  assert.equal(report.rubric.testing, null);
  const request = sent[0].body as { output_config: { format: { type: string } }; messages: { content: string }[] };
  assert.equal(request.output_config.format.type, 'json_schema');
  assert.equal(request.messages[0].content.includes('Candidate: I add them.'), true);
  assert.equal(request.messages[0].content.includes('SOLUTION-MARKER'), true);
  const feedback = reportFeedback(report, { seed: 'abc123', rerolls: [1], itemIds: ['cq-sum', 'iq-bq'] });
  const decoded = decodeFeedback(encodeFeedback(feedback)!.value)!;
  assert.equal(decoded.ai, true);
  assert.deepEqual(decoded.rubric, { communication: 3, problem: 2, coding: 4, complexity: 1 });
  assert.equal(decoded.verdict, 'yes');
  assert.equal(decoded.questions[0].tag, questionTag('cq-sum'));
  assert.equal(decoded.questions[0].rating, 3);
  // Feedback a person wrote has no flag.
  assert.equal('ai' in decodeFeedback(encodeFeedback({ ...feedback, ai: false })!.value)!, false);
  reply = ok('not json');
  assert.equal((await call(me, 'interview-report', { seed: 'abc123', ticket, locale: 'en', questions })).status, 503);
  // A reply that came back but could not be used is still a spent call.
  assert.equal(used(me.id, 'interview-call'), 2);
});
