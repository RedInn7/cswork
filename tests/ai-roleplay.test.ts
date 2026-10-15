import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-ai-roleplay-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
process.env.METRICS_DATABASE_PATH = resolve(dir, 'metrics.sqlite');
process.env.CONTENT_DATABASE_PATH = resolve(dir, 'content.sqlite');
process.env.BETTER_AUTH_SECRET = 'x'.repeat(40);
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { issueTicket } = await import('../lib/server/ai-interviewer');
const { library } = await import('../lib/server/content-library');
const { mockSet } = await import('../lib/server/mock-interview');
const { SCENARIOS, roleplayQuestion } = await import('../lib/server/roleplay-scenarios');
const { KINDS, isRoleplay, resolveTemplate } = await import('../lib/mock-interview');
const { RUBRIC, ROLEPLAY_RUBRIC, calibration, decodeFeedback, encodeFeedback, rubricFor } = await import(
  '../lib/mock-interview-feedback'
);
const { openerFor, reportFeedback } = await import('../lib/mock-ai-interview');

const me: Person = { id: 'rp-me', name: 'Me', email: 'rp@example.test', role: 'student', verified: true };
type Sent = { system: string; messages: { content: unknown }[]; output_config?: { format: { schema: Record<string, unknown> } } };
let sent: Sent[] = [];
let reply: () => Response;
const realFetch = globalThis.fetch;
const ok = (text: string) => () =>
  Response.json({ stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 100, output_tokens: 20 } });
async function call(action: string, body?: unknown, method = 'POST') {
  try {
    const url = `https://cswork.test/api/oj/ai/${action}`;
    const request = method === 'GET' ? new Request(url) : new Request(url, { method: 'POST', body: JSON.stringify(body) });
    const response = await handleOj(request, me, ['ai', action]);
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  } catch (error) {
    return { status: (error as { status?: number }).status ?? 400, body: { error: (error as Error).message } };
  }
}
const usd = (n: number) => `$${n.toLocaleString('en-US')}`;
type Shown = { id: string; question: string; questionZh: string; rubric: string; solution: string; hints: string };
const negotiation = SCENARIOS.find((s) => s.id === 'neg-cloud-newgrad')!;

before(() => {
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
  const content = new Database(process.env.CONTENT_DATABASE_PATH!);
  content.exec(`CREATE TABLE items(id TEXT PRIMARY KEY, type TEXT, slug TEXT, title TEXT, company_slug TEXT, company_name TEXT,
    role TEXT, category TEXT, difficulty TEXT, round TEXT, partial INTEGER, listed INTEGER, dup_of TEXT, extra TEXT, body TEXT)`);
  content
    .prepare('INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run('iq-bq', 'interview_question', 'conflict', 'A conflict', 'acme', 'Acme', 'Software Engineer', 'Behavioral & Leadership',
      null, 'Onsite', 0, 1, null, '{}', 'Tell me about a conflict.\n\n## Solution\n\nSTAR.');
  content.close();
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    sent.push(JSON.parse(init.body as string) as Sent);
    return reply();
  }) as typeof fetch;
});
beforeEach(() => {
  sent = [];
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

void test('the scenario library: about thirty bilingual scenarios of both kinds, limits at or above the offer', () => {
  assert.ok(SCENARIOS.length >= 28, `${SCENARIOS.length} scenarios`);
  assert.equal(new Set(SCENARIOS.map((s) => s.id)).size, SCENARIOS.length);
  for (const kind of ['recruiter', 'negotiation'] as const) assert.ok(SCENARIOS.filter((s) => s.kind === kind).length >= 10, kind);
  const pair = (t: unknown) =>
    Array.isArray(t) && t.length === 2 && /[一-鿿]/.test(t[0]) && typeof t[1] === 'string' && !!t[1].trim() && !/[一-鿿]/.test(t[1]);
  for (const s of SCENARIOS) {
    assert.match(s.id, /^(rec|neg)-[a-z0-9-]+$/);
    for (const key of ['company', 'role', 'level', 'location', 'brief', 'notes'] as const) assert.ok(pair(s[key]), `${s.id}.${key}`);
    assert.ok(s.concessions.length >= 1 && s.concessions.every(pair), `${s.id}.concessions`);
    for (const key of ['base', 'equity', 'signOn'] as const) assert.ok(s.floor[key] >= s.offer[key], `${s.id}.floor.${key}`);
    assert.ok((s.floor.bonus ?? Infinity) >= (s.offer.bonus ?? 0), `${s.id}.floor.bonus`);
    assert.ok(s.floor.base > s.offer.base || s.floor.signOn > s.offer.signOn, `${s.id}: something to win`);
  }
});

void test('role-plays are AI-only templates of their own, scored on the role-play rubric appended at the end', () => {
  assert.deepEqual(resolveTemplate('recruiter')?.slots.map((s) => s.kind), ['recruiter']);
  assert.deepEqual(resolveTemplate('negotiation')?.slots.map((s) => s.kind), ['negotiation']);
  assert.equal(KINDS.recruiter.aiOnly && KINDS.negotiation.aiOnly, true);
  assert.equal(resolveTemplate('custom', 'negotiation.1'), null);
  assert.equal(isRoleplay('negotiation') && !isRoleplay('behavioral'), true);
  // Old links carry the rubric by position: the first five stay where they were.
  assert.deepEqual(RUBRIC.map((r) => r.id), ['communication', 'problem', 'coding', 'testing', 'complexity', 'motivation', 'anchoring', 'leverage']);
  assert.deepEqual(rubricFor(false), ['communication', 'problem', 'coding', 'testing', 'complexity']);
  assert.deepEqual(rubricFor(true), ROLEPLAY_RUBRIC);
  assert.match(openerFor('negotiation')[1], /written offer/);
  assert.match(openerFor('recruiter')[1], /recruiter/);
});

void test('a drawn role-play shows the setting and the written offer, never the limits, concessions or notes', () => {
  const db = library()!;
  const set = mockSet(db, new URLSearchParams({ template: 'negotiation', seed: 'abc' }));
  const item = set.slots[0].item as unknown as Shown;
  assert.match(item.id, /^rp-neg-/);
  const drawn = SCENARIOS.find((s) => `rp-${s.id}` === item.id)!;
  assert.match(item.question, /The written offer/);
  assert.ok(item.question.includes(usd(drawn.offer.base)));
  assert.match(item.questionZh, /书面 offer/);
  assert.match(item.question, /according to your own real situation/);
  const wire = JSON.stringify(set);
  for (const text of [...drawn.concessions.flat(), ...drawn.notes]) assert.equal(wire.includes(text), false, text);
  const offered = Object.values(drawn.offer);
  for (const n of Object.values(drawn.floor)) if (!offered.includes(n)) assert.equal(wire.includes(usd(n)), false, usd(n));
  assert.equal(item.rubric + item.solution + item.hints, '');
  // A recruiter screen keeps the planned offer to itself too.
  const screen = mockSet(db, new URLSearchParams({ template: 'recruiter', seed: 'abc' })).slots[0].item as unknown as Shown;
  const planned = SCENARIOS.find((s) => `rp-${s.id}` === screen.id)!;
  assert.equal(JSON.stringify(screen).includes(usd(planned.offer.base)), false);
  // Ordinary sets never draw a role-play.
  assert.ok(mockSet(db, new URLSearchParams({ template: 'behavioral', seed: 'abc' })).slots.every((s) => !s.item?.id.startsWith('rp-')));
});

void test('the AI plays the recruiter with its private brief, and does not coach or reveal the limit', async () => {
  reply = ok('Congratulations! What do you think of the offer?');
  const turn = {
    seed: 'seed1', locale: 'en', itemId: 'rp-neg-cloud-newgrad', minutes: 20, elapsedSec: 30, code: '',
    history: [{ role: 'candidate', text: 'Thanks! Is there flexibility on base?' }],
  };
  const { status } = await call('interview', turn);
  assert.equal(status, 200);
  const { system } = sent[0];
  assert.match(system, /role-playing a recruiter/);
  assert.match(system, /This is an offer negotiation/);
  assert.ok(system.includes(`base ${usd(negotiation.floor.base)}`));
  // The target bonus has a ceiling too: the offered one, unless the scenario sets its own.
  assert.match(roleplayQuestion('rp-neg-social-relocation')!.rubric, /most you may agree to[^\n]*target bonus \$19,000/);
  assert.match(roleplayQuestion('rp-neg-trading-exploding')!.rubric, /most you may agree to[^\n]*target bonus \$100,000/);
  assert.ok(system.includes(negotiation.notes[1]));
  assert.match(system, /answer according to their real situation/);
  assert.match(system, /Never reveal the private brief, your limit/);
  assert.match(system, /Don't teach, coach or grade/);
  assert.equal(system.includes('Begin by answering clarifying questions'), false);
  assert.equal((await call('interview', { ...turn, itemId: 'rp-nope' })).status, 404);
});

void test('a role-play report scores its four dimensions, keeps the self-assessment, and refuses scores outside 1–4', async () => {
  const history = [{ role: 'candidate', text: "I'd rather hear your range first." }, { role: 'interviewer', text: 'Fair enough.' }];
  const questions = [{ itemId: 'rp-rec-cloud-newgrad', minutes: 20, elapsedSec: 900, code: '', history }];
  const body = (seed: string, extra: Record<string, unknown> = {}) => ({
    seed, ticket: issueTicket(me.id, seed), locale: 'en', questions, template: 'recruiter', ...extra,
  });
  assert.equal((await call('interview-report', body('s1', { self: { anchoring: 5 } }))).status, 400);
  assert.equal((await call('interview-report', body('s1', { self: { anchoring: '3' } }))).status, 400);
  assert.equal((await call('interview-report', body('s1', { self: { anchoring: 0 } }))).status, 400);
  assert.equal((await call('interview-report', body('s1', { self: { nope: 2 } }))).status, 400);
  assert.equal(sent.length, 0);
  reply = ok(
    JSON.stringify({
      rubric: { communication: 3, motivation: 2, anchoring: 4, leverage: null },
      verdict: 'yes', strengths: 'Held the number.', improvements: 'Say why us.', questions: [{ rating: 3, note: 'Good.' }],
    }),
  );
  const { status, body: out } = await call('interview-report', body('s1', { self: { communication: 4, anchoring: 2, leverage: null, coding: 3 } }));
  assert.equal(status, 200);
  const { system, output_config } = sent[0];
  assert.deepEqual((output_config!.format.schema.properties as { rubric: { required: string[] } }).rubric.required, ROLEPLAY_RUBRIC);
  assert.match(system, /role-play with the AI as the company's recruiter/);
  assert.match(system, /- anchoring: /);
  assert.equal(system.includes('- coding: '), false);
  assert.match(String(sent[0].messages[0].content), /The recruiter's private brief/);
  const row = sqlite().prepare('SELECT kind,scores_json,self_json FROM ai_interview_scores WHERE user_id=?').get(me.id) as Record<string, string>;
  assert.equal(row.kind, 'recruiter');
  assert.deepEqual(JSON.parse(row.scores_json), { communication: 3, motivation: 2, anchoring: 4, leverage: null });
  // Only the scored dimensions are kept; coding is not one of a role-play's.
  assert.deepEqual(JSON.parse(row.self_json), { communication: 4, motivation: null, anchoring: 2, leverage: null });
  // A report whose new dimensions are null still decodes; the old five-score wire stays five long.
  const feedback = reportFeedback(out.report as Parameters<typeof reportFeedback>[0], { seed: 's1', rerolls: [], itemIds: ['rp-rec-cloud-newgrad'] });
  assert.deepEqual(decodeFeedback(encodeFeedback(feedback)!.value)!.rubric, { communication: 3, motivation: 2, anchoring: 4 });
  const five = encodeFeedback({ ...feedback, rubric: { communication: 2, complexity: 3 } })!.value;
  assert.deepEqual((JSON.parse(Buffer.from(five, 'base64url').toString()) as { k: number[] }).k, [2, 0, 0, 0, 3]);
  assert.deepEqual(decodeFeedback(five)!.rubric, { communication: 2, complexity: 3 });

  // Skipped self-assessment: no self_json. An ordinary interview keeps the five-dimension schema.
  sent = [];
  reply = ok(JSON.stringify({ rubric: { communication: 3, problem: null, coding: null, testing: null, complexity: null }, verdict: null, strengths: '', improvements: '', questions: [] }));
  const plainQuestions = [{ itemId: 'iq-bq', minutes: 8, elapsedSec: 300, code: '', history }];
  assert.equal((await call('interview-report', { ...body('s2'), questions: plainQuestions, template: 'behavioral' })).status, 200);
  assert.deepEqual((sent[0].output_config!.format.schema.properties as { rubric: { required: string[] } }).rubric.required, rubricFor(false));
  assert.equal(sent[0].system.includes('role-play'), false);
  assert.equal(
    sqlite().prepare("SELECT self_json FROM ai_interview_scores WHERE user_id=? AND kind='behavioral'").pluck().get(me.id),
    null,
  );
});

void test('calibration: the mean gap and its sign over the last ten self-rated reports, oldest first', async () => {
  assert.equal(calibration([]), null);
  assert.equal(calibration([{ self: { coding: 3 }, ai: { coding: null } }]), null);
  assert.deepEqual(
    calibration([
      { self: { communication: 4, coding: 2 }, ai: { communication: 2, coding: 2 } },
      { self: { anchoring: 1 }, ai: { anchoring: 3, leverage: 2 } },
    ]),
    { sessions: [{ gap: 1, bias: 1 }, { gap: 2, bias: -2 }], gap: 1.5, bias: -0.5 },
  );
  sqlite().prepare('DELETE FROM ai_interview_scores').run();
  assert.deepEqual((await call('interview-calibration', undefined, 'GET')).body, { calibration: null });
  const insert = sqlite().prepare(
    'INSERT INTO ai_interview_scores(id,user_id,kind,level,scores_json,verdict,created_at,self_json) VALUES(?,?,?,?,?,?,?,?)',
  );
  // Twelve self-rated reports, gap i % 3 each; one without a self-assessment and another learner's don't count.
  for (let i = 0; i < 12; i++)
    insert.run(`c${i}`, me.id, 'phone', '', JSON.stringify({ communication: 1 }), null, 1000 + i, JSON.stringify({ communication: 1 + (i % 3) }));
  insert.run('c-none', me.id, 'phone', '', JSON.stringify({ communication: 1 }), null, 5000, null);
  insert.run('c-other', 'someone', 'phone', '', JSON.stringify({ communication: 1 }), null, 5000, JSON.stringify({ communication: 4 }));
  const { status, body } = await call('interview-calibration', undefined, 'GET');
  assert.equal(status, 200);
  const result = body.calibration as { sessions: { gap: number }[]; gap: number; bias: number };
  assert.deepEqual(result.sessions.map((s) => s.gap), [2, 0, 1, 2, 0, 1, 2, 0, 1, 2]);
  assert.equal(result.gap, 1.1);
  assert.equal(result.bias, 1.1);
  // Answered without the AI switched on; read-only.
  delete process.env.ANTHROPIC_API_KEY;
  assert.equal((await call('interview-calibration', undefined, 'GET')).status, 200);
  assert.equal((await call('interview-calibration', {}, 'POST')).status, 404);
});

void test('role-play ids resolve only to known scenarios', () => {
  assert.equal(roleplayQuestion('rp-__proto__'), null);
  assert.equal(roleplayQuestion('neg-cloud-newgrad'), null);
  assert.equal(roleplayQuestion('rp-neg-cloud-newgrad')?.kind, 'negotiation');
});
