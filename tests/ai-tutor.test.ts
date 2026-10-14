import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
import type { OjProblemPackage } from '../lib/oj-types';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-ai-tutor-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
process.env.METRICS_DATABASE_PATH = resolve(dir, 'metrics.sqlite');
const { sqlite } = await import('../db/sqlite');
const { saveProblemDraft, publishProblemDraft } = await import('../lib/server/oj-problems');
const { handleOj } = await import('../lib/server/oj-api');
const { aiEnabled, tidyReply, AI_DAILY_LIMITS, SYSTEM } = await import('../lib/server/ai-tutor');

const me: Person = { id: 'ai-me', name: 'Me', email: 'ai@example.test', role: 'student', verified: true };
const other: Person = { ...me, id: 'ai-other', email: 'ai-other@example.test' };
const unverified: Person = { ...me, id: 'ai-new', email: 'ai-new@example.test', verified: false };
const teacher: Person = { ...me, id: 'ai-teacher', role: 'teacher' };
const SECRET_CODE = 'def solve(): return 42  # MY-CODE-MARKER';

type Sent = { url: string; headers: Record<string, string>; body: Record<string, unknown> };
let sent: Sent[] = [];
let reply: () => Response;
const realFetch = globalThis.fetch;
const ok = (text: string, extra: Record<string, unknown> = {}) => () =>
  Response.json({
    stop_reason: 'end_turn',
    // Adaptive thinking may lead with an empty thinking block: only text blocks are read.
    content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }],
    usage: { input_tokens: 900, output_tokens: 60 },
    ...extra,
  });

function call(p: Person, kind: string, body: unknown, method = 'POST') {
  const url = new URL(`https://cswork.test/api/oj/ai/${kind}`);
  const request = new Request(url, {
    method,
    body: method === 'POST' ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json' },
  });
  return handleOj(request, p, ['ai', kind]);
}
async function status(p: Person, kind: string, body: unknown, method = 'POST') {
  try {
    return (await call(p, kind, body, method)).status;
  } catch (error) {
    return (error as { status?: number }).status ?? 400;
  }
}
const ask = (extra: Record<string, unknown> = {}) => ({
  problemId: 'lc-1',
  language: 'python',
  codingMode: 'leetcode',
  code: SECRET_CODE,
  locale: 'en',
  ...extra,
});
const used = (user: string, kind: string) =>
  (sqlite().prepare('SELECT count FROM ai_usage WHERE user_id=? AND kind=?').pluck().get(user, kind) as
    | number
    | undefined) ?? 0;

function fixture(id: string): OjProblemPackage {
  return {
    schemaVersion: 1,
    problem: {
      id,
      courseId: 'gomall',
      lessonId: '00-overview',
      title: 'Two Sum',
      difficulty: '简单',
      tags: ['hash'],
      description: 'Stub.',
      input: 'n',
      output: 'm',
      explanation: '',
      hints: [],
      timeLimit: 2,
      memoryLimit: 262144,
      outputLimit: 64,
      checker: 'tokens',
      languages: ['python'],
    },
    cases: [
      { name: 'sample', input: '1\n', expectedOutput: '1\n', hidden: false, weight: 1 },
      { name: 'hidden', input: 'HIDDEN-CASE-INPUT\n', expectedOutput: 'HIDDEN-OUT\n', hidden: true, weight: 1 },
    ],
  };
}

before(async () => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  db.prepare("INSERT INTO courses(id,title,summary,version,published) VALUES('gomall','T','T','1',1)").run();
  db.prepare(
    "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES('00-overview','gomall','T','','t',0,'','1',0)",
  ).run();
  const saved = await saveProblemDraft(teacher, fixture('lc-1'), null);
  await publishProblemDraft(teacher, 'lc-1', saved.draft!.revision);
  const { version } = db.prepare('SELECT current_version_id AS version FROM oj_problems WHERE id=?').get('lc-1') as {
    version: string;
  };
  // A library problem: free for verified accounts, with the full statement in the source payload.
  db.prepare(
    `INSERT INTO study_library(id,number,slug,title_zh,title_en,difficulty,topics_json,payload_json,content_hash,
    case_count,expected_count,judge_problem_id,verified_hash,imported_at) VALUES('lc-1',1,'two-sum','两数之和','Two Sum','简单','[]',?,
    'source',1,1,'lc-1',?,0)`,
  ).run(
    JSON.stringify({ descriptionEn: 'Find two indices. STATEMENT-MARKER', descriptionZh: '找两个下标。' }),
    `source:${version}`,
  );
  db.prepare(
    `INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,mode,created_at,updated_at)
    VALUES('ai-s1',?,'lc-1','python','x','wrong_answer',3,7,'judge',1,1)`,
  ).run(me.id);
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent.push({
      url,
      headers: init.headers as Record<string, string>,
      body: JSON.parse(String(init.body)),
    });
    return reply();
  }) as typeof fetch;
});
beforeEach(() => {
  sent = [];
  reply = ok('What happens to your loop when the pair uses the same index twice?');
  process.env.ANTHROPIC_API_KEY = 'test-key';
  delete process.env.AI_TUTOR_DAILY_BUDGET;
  // The per-minute burst limit is not under test here.
  sqlite().prepare('DELETE FROM limits').run();
});
after(() => {
  globalThis.fetch = realFetch;
  delete process.env.ANTHROPIC_API_KEY;
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('off without ANTHROPIC_API_KEY: no route, no upstream call', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  assert.equal(aiEnabled(), false);
  assert.equal(await status(me, 'hint', ask()), 404);
  assert.equal(sent.length, 0);
  process.env.ANTHROPIC_API_KEY = 'test-key';
  assert.equal(aiEnabled(), true);
  assert.equal(await status(me, 'hint', ask(), 'GET'), 404);
});

void test('a hint: fast model, Socratic system prompt, statement + code + verdict, no code in the reply', async () => {
  reply = ok('Think about duplicates.\n```python\nfor i in range(n):\n    pass\n```\n![x](https://evil.test/p.png)');
  const response = await call(me, 'hint', ask({ previous: ['Earlier nudge.'] }));
  assert.equal(response.status, 200);
  const body = (await response.json()) as { text: string; remaining: number; limit: number };
  assert.equal(body.text.includes('```'), false);
  assert.equal(body.text.includes('evil.test'), false);
  assert.equal(body.text.startsWith('Think about duplicates.'), true);
  assert.equal(body.remaining, AI_DAILY_LIMITS.hint - 1);
  assert.equal(sent.length, 1);
  const [{ url, headers, body: request }] = sent;
  assert.equal(url, 'https://api.anthropic.com/v1/messages');
  assert.equal(headers['x-api-key'], 'test-key');
  assert.equal(headers['anthropic-version'], '2023-06-01');
  assert.equal('anthropic-beta' in headers, false);
  assert.equal(request.model, 'claude-haiku-5-5');
  // Haiku has no server-side fallback: the field would be refused.
  assert.equal('fallbacks' in request, false);
  assert.equal(typeof request.max_tokens === 'number' && request.max_tokens <= 1024, true);
  assert.equal(request.system, SYSTEM.hint);
  assert.equal(SYSTEM.hint.includes('Never write code'), true);
  const user = (request.messages as { role: string; content: string }[])[0];
  assert.equal(user.role, 'user');
  assert.equal(user.content.includes('STATEMENT-MARKER'), true);
  assert.equal(user.content.includes('MY-CODE-MARKER'), true);
  assert.equal(user.content.includes('Wrong answer, 3/7'), true);
  assert.equal(user.content.includes('Earlier nudge.'), true);
  assert.equal(user.content.includes('Reply in English.'), true);
  // Hidden test data never reaches the model.
  assert.equal(user.content.includes('HIDDEN-CASE-INPUT'), false);
});

void test('a review: balanced model with the default refusal fallback; short snippets survive', async () => {
  reply = ok('**Complexity** O(n).\n```python\nseen = {}\n```\n**Style** fine.');
  const response = await call(me, 'review', ask({ locale: 'zh' }));
  assert.equal(response.status, 200);
  const body = (await response.json()) as { text: string };
  assert.equal(body.text.includes('seen = {}'), true);
  const [{ headers, body: request }] = sent;
  assert.equal(request.model, 'claude-sonnet-5-5');
  assert.equal(request.fallbacks, 'default');
  assert.equal(headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  assert.equal(request.system, SYSTEM.review);
  const user = (request.messages as { content: string }[])[0].content;
  assert.equal(user.includes('Reply in Simplified Chinese.'), true);
  // Nothing to review: refused before any upstream call.
  sent = [];
  assert.equal(await status(me, 'review', ask({ code: '   ' })), 400);
  assert.equal(sent.length, 0);
});

void test('gates: verified account, visible problem, size and shape limits', async () => {
  assert.equal(await status(unverified, 'hint', ask()), 403);
  assert.equal(await status(me, 'hint', ask({ problemId: 'lc-404' })), 404);
  assert.equal(await status(me, 'hint', ask({ code: 'x'.repeat(20_001) })), 413);
  assert.equal(await status(me, 'hint', ask({ language: 'ruby' })), 400);
  assert.equal(await status(me, 'hint', ask({ extra: 1 })), 400);
  assert.equal(await status(me, 'hint', ask({ previous: ['a', 'b', 'c', 'd'] })), 400);
  assert.equal(await status(me, 'quiz', ask()), 404);
  assert.equal(sent.length, 0);
});

void test('a failed upstream call hands the quota back; a refusal spends it', async () => {
  const before = used(other.id, 'hint');
  reply = () => new Response('{"error":{"type":"overloaded_error"}}', { status: 529 });
  assert.equal(await status(other, 'hint', ask()), 503);
  assert.equal(used(other.id, 'hint'), before);
  reply = () => {
    throw new TypeError('fetch failed');
  };
  assert.equal(await status(other, 'hint', ask()), 503);
  assert.equal(used(other.id, 'hint'), before);
  // Only thinking, or only code: nothing to show, so nothing is charged.
  reply = ok('```\nprint(1)\n```');
  assert.equal(await status(other, 'hint', ask()), 503);
  assert.equal(used(other.id, 'hint'), before);
  reply = ok('', { stop_reason: 'refusal', content: [] });
  assert.equal(await status(other, 'hint', ask()), 422);
  assert.equal(used(other.id, 'hint'), before + 1);
});

void test('per-learner daily limit, then the site-wide daily budget', async () => {
  const learner: Person = { ...me, id: 'ai-limit', email: 'ai-limit@example.test' };
  for (let i = 0; i < AI_DAILY_LIMITS.review; i++) {
    sqlite().prepare('DELETE FROM limits').run();
    assert.equal(await status(learner, 'review', ask()), 200);
  }
  sent = [];
  assert.equal(await status(learner, 'review', ask()), 429);
  assert.equal(sent.length, 0);
  // Hints keep their own quota.
  assert.equal(await status(learner, 'hint', ask()), 200);
  const spent = sqlite().prepare('SELECT SUM(count) FROM ai_usage').pluck().get() as number;
  process.env.AI_TUTOR_DAILY_BUDGET = String(spent);
  sent = [];
  sqlite().prepare('DELETE FROM limits').run();
  assert.equal(await status({ ...me, id: 'ai-fresh', email: 'f@example.test' }, 'hint', ask()), 503);
  assert.equal(sent.length, 0);
});

void test('metrics get counts only, never the code, statement or reply', () => {
  const events = new Database(process.env.METRICS_DATABASE_PATH!, { readonly: true })
    .prepare("SELECT params FROM events WHERE name='ai_tutor'")
    .pluck()
    .all() as string[];
  assert.equal(events.length > 0, true);
  for (const params of events) {
    assert.deepEqual(Object.keys(JSON.parse(params)).sort(), ['input_tokens', 'kind', 'outcome', 'output_tokens']);
    assert.equal(/MARKER|duplicates/.test(params), false);
  }
  const tokens = sqlite().prepare('SELECT SUM(input_tokens) FROM ai_usage').pluck().get() as number;
  assert.equal(tokens > 0, true);
});

void test('tidyReply: no images, hint code blocks dropped, long review blocks dropped, capped', () => {
  assert.equal(tidyReply('See ![diagram](https://x.test/a.png).', 'hint'), 'See diagram.');
  assert.equal(tidyReply('Ask why.\n```\nx = 1\n```', 'hint'), 'Ask why.');
  const long = '```py\n' + 'a = 1\n'.repeat(5) + '```';
  assert.equal(tidyReply(`Fine.\n${long}`, 'review'), 'Fine.');
  assert.equal(tidyReply('```py\na = 1\n```', 'review'), '```py\na = 1\n```');
  // An unclosed fence still counts as code.
  assert.equal(tidyReply('Hmm.\n```\nwhile True:', 'hint'), 'Hmm.');
  assert.equal(tidyReply('x'.repeat(5000), 'hint').length <= 1201, true);
});
