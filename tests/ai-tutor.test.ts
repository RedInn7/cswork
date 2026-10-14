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
const { aiEnabled, tidyReply, caseFormat, parseCases, AI_DAILY_LIMITS, AI_KINDS, SYSTEM, CHAT_SOLVED } = await import(
  '../lib/server/ai-tutor'
);

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

function call(p: Person, kind: string, body: unknown, method = 'POST', signal?: AbortSignal) {
  const url = new URL(`https://cswork.test/api/oj/ai/${kind}`);
  const request = new Request(url, {
    method,
    body: method === 'POST' ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json' },
    signal,
  });
  return handleOj(request, p, ['ai', kind]);
}
async function status(p: Person, kind: string, body: unknown, method = 'POST', signal?: AbortSignal) {
  try {
    return (await call(p, kind, body, method, signal)).status;
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

let version = '';
before(async () => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  db.prepare("INSERT INTO courses(id,title,summary,version,published) VALUES('gomall','T','T','1',1)").run();
  db.prepare(
    "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES('00-overview','gomall','T','','t',0,'','1',0)",
  ).run();
  const saved = await saveProblemDraft(teacher, fixture('lc-1'), null);
  await publishProblemDraft(teacher, 'lc-1', saved.draft!.revision);
  ({ version } = db.prepare('SELECT current_version_id AS version FROM oj_problems WHERE id=?').get('lc-1') as {
    version: string;
  });
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
    VALUES('ai-s1',?,'lc-1','python','x','wrong_answer',3,7,'judge',1,1),
    -- Newer but still judging: the tutor reads the last finished verdict instead.
    ('ai-s2',?,'lc-1','python','x','queued',0,0,'judge',2,2)`,
  ).run(me.id, me.id);
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

void test('only a call the API cannot have billed hands the quota back', async () => {
  const before = used(other.id, 'hint');
  reply = () => new Response('{"error":{"type":"overloaded_error"}}', { status: 529 });
  assert.equal(await status(other, 'hint', ask()), 503);
  assert.equal(used(other.id, 'hint'), before);
  reply = () => {
    throw new TypeError('fetch failed');
  };
  assert.equal(await status(other, 'hint', ask()), 503);
  assert.equal(used(other.id, 'hint'), before);
  // A 200 was billed even when nothing is left to show (only thinking, or only code).
  reply = ok('```\nprint(1)\n```');
  assert.equal(await status(other, 'hint', ask()), 503);
  assert.equal(used(other.id, 'hint'), before + 1);
  reply = ok('', { stop_reason: 'refusal', content: [] });
  assert.equal(await status(other, 'hint', ask()), 422);
  assert.equal(used(other.id, 'hint'), before + 2);
  // A learner who cancels mid-call: the request may have reached the API, so it counts.
  const controller = new AbortController();
  reply = () => {
    controller.abort();
    throw new DOMException('aborted', 'AbortError');
  };
  assert.equal(await status(other, 'hint', ask(), 'POST', controller.signal), 503);
  assert.equal(used(other.id, 'hint'), before + 3);
  // The whole budget counts those calls too.
  const spent = sqlite().prepare('SELECT SUM(count) FROM ai_usage').pluck().get() as number;
  assert.equal(spent >= 3, true);
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
  // 0 pauses the tutor; an unparsable value falls back to the default.
  process.env.AI_TUTOR_DAILY_BUDGET = '0';
  assert.equal(await status({ ...me, id: 'ai-zero', email: 'z@example.test' }, 'hint', ask()), 503);
  assert.equal(sent.length, 0);
  process.env.AI_TUTOR_DAILY_BUDGET = 'lots';
  assert.equal(await status({ ...me, id: 'ai-zero', email: 'z@example.test' }, 'hint', ask()), 200);
});

void test('usage: calls left today, so the buttons start from the real count', async () => {
  const learner: Person = { ...me, id: 'ai-usage', email: 'ai-usage@example.test' };
  const left = async () => (await (await call(learner, 'usage', null, 'GET')).json()) as Record<string, number>;
  // bonus: calls bought with points (lib/server/points.ts), none here.
  assert.deepEqual(await left(), { ...AI_DAILY_LIMITS, bonus: 0 });
  assert.deepEqual(Object.keys(AI_DAILY_LIMITS).sort(), [...AI_KINDS].sort());
  assert.equal(await status(learner, 'hint', ask()), 200);
  assert.deepEqual(await left(), { ...AI_DAILY_LIMITS, hint: AI_DAILY_LIMITS.hint - 1, bonus: 0 });
  assert.equal(await status(learner, 'usage', ask()), 404);
  delete process.env.ANTHROPIC_API_KEY;
  assert.equal(await status(learner, 'usage', null, 'GET'), 404);
});

void test('the verdict: the last finished one, and an earlier AC still makes it a review of a pass', async () => {
  const learner: Person = { ...me, id: 'ai-ac', email: 'ai-ac@example.test' };
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,mode,created_at,updated_at)
      VALUES('ai-ac1',?,'lc-1','python','x','accepted',7,7,'judge',3,3),('ai-ac2',?,'lc-1','python','x','wrong_answer',0,1,'run',4,4),
      ('ai-ac3',?,'lc-1','python','x','cancelled',0,0,'judge',5,5)`,
    )
    .run(learner.id, learner.id, learner.id);
  assert.equal(await status(learner, 'review', ask()), 200);
  const user = (sent[0].body.messages as { content: string }[])[0].content;
  assert.equal(user.includes('Test run on the examples (python): Wrong answer, 0/1'), true);
  assert.equal(user.includes('An earlier submission was accepted.'), true);
  assert.equal(user.includes('Review this accepted solution.'), true);
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
  assert.equal(tidyReply('Read [the docs](javascript:alert(1)).', 'review'), 'Read the docs.');
  assert.equal(tidyReply('Ask why.\n```\nx = 1\n```', 'hint'), 'Ask why.');
  const long = '```py\n' + 'a = 1\n'.repeat(5) + '```';
  assert.equal(tidyReply(`Fine.\n${long}`, 'review'), 'Fine.');
  assert.equal(tidyReply('```py\na = 1\n```', 'review'), '```py\na = 1\n```');
  // An unclosed fence still counts as code.
  assert.equal(tidyReply('Hmm.\n```\nwhile True:', 'hint'), 'Hmm.');
  assert.equal(tidyReply('x'.repeat(5000), 'hint').length <= 1201, true);
});

void test('tidyReply: no way around the code caps', () => {
  const solution = 'def twoSum(nums, target):\n    seen = {}\n    for i, x in enumerate(nums):\n        if target - x in seen:\n            return [seen[target - x], i]\n        seen[x] = i';
  // Tilde fences, fences inside a list or quote, unclosed fences.
  assert.equal(tidyReply(`Hmm.\n~~~python\n${solution}\n~~~\nWhy?`, 'hint'), 'Hmm.\nWhy?');
  assert.equal(tidyReply(`Hmm.\n- ~~~\n  ${solution}\n  ~~~`, 'hint'), 'Hmm.');
  assert.equal(tidyReply('Hmm.\n> ```\n> x = 1\n> ```', 'hint'), 'Hmm.');
  assert.equal(tidyReply('Hmm.\n```\nwhile True:\n  pass', 'hint'), 'Hmm.');
  // A four-backtick fence leaves no stray backtick.
  assert.equal(tidyReply('Hmm.\n````\nx = 1\n```\n````\nWhy?', 'hint'), 'Hmm.\nWhy?');
  // An indented code block.
  const indented = solution
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');
  assert.equal(tidyReply(`Hmm.\n\n${indented}\n\nWhy?`, 'hint'), 'Hmm.\n\nWhy?');
  // A nested list item is not code.
  assert.equal(tidyReply('- a\n\n    - b', 'review'), '- a\n\n    - b');
  // Inline spans: short ones stay, long or too many go, even across lines.
  assert.equal(tidyReply('Check `nums[i]`.', 'hint'), 'Check `nums[i]`.');
  assert.equal(tidyReply(`Use \`${solution}\`.`, 'hint').includes('seen'), false);
  const many = tidyReply('`a=1` `b=2` `c=3` `d=4` `e=5` `f=6`', 'hint');
  assert.equal(many.includes('`d=4`') && !many.includes('e=5') && !many.includes('f=6'), true);
  // A review keeps at most two short blocks, six lines in all.
  const block = (n: number) => '```py\n' + 'a = 1\n'.repeat(n) + '```';
  const review = tidyReply([block(3), block(3), block(3)].join('\nand\n'), 'review');
  assert.equal(review.split('a = 1').length - 1, 6);
  assert.equal(tidyReply([block(4), block(3)].join('\n'), 'review').split('a = 1').length - 1, 4);
});

const body = async (response: Response) => (await response.json()) as Record<string, unknown>;
const userTurns = () => sent[0].body.messages as { role: string; content: string }[];

void test('chat: the conversation goes back as turns; no code and no solution before an AC', async () => {
  const learner: Person = { ...me, id: 'ai-chat', email: 'ai-chat@example.test' };
  reply = ok('Ask yourself what a hash map remembers.\n```python\nseen = {}\n```');
  const history = [
    { role: 'assistant', text: 'A stray first answer is dropped.' },
    { role: 'user', text: 'Why is my loop slow?' },
    { role: 'assistant', text: 'Count how many pairs it checks.' },
  ];
  const response = await call(learner, 'chat', ask({ question: 'Can I do better than n squared?', history }));
  assert.equal(response.status, 200);
  const answer = await body(response);
  assert.equal(answer.kind, 'chat');
  assert.equal(String(answer.text).includes('```'), false, 'no code before an AC');
  assert.equal(answer.remaining, AI_DAILY_LIMITS.chat - 1);
  const [{ body: request }] = sent;
  assert.equal(request.model, 'claude-haiku-5-5');
  assert.equal(request.system, SYSTEM.chat);
  assert.equal(SYSTEM.chat.includes('Never write code'), true);
  const turns = userTurns();
  assert.deepEqual(
    turns.map((t) => t.role),
    ['user', 'assistant', 'user'],
  );
  // The problem, code and verdict ride on the first user turn; the new question comes last.
  assert.equal(turns[0].content.includes('STATEMENT-MARKER') && turns[0].content.includes('MY-CODE-MARKER'), true);
  assert.equal(turns[0].content.includes('Why is my loop slow?'), true);
  assert.equal(turns[0].content.includes('Reply in English throughout.'), true);
  assert.equal(turns[2].content, 'Can I do better than n squared?');
  assert.equal(JSON.stringify(turns).includes('HIDDEN-CASE-INPUT'), false);
  // Shape limits: a question is required, at most 16 earlier turns.
  assert.equal(await status(learner, 'chat', ask()), 400);
  assert.equal(await status(learner, 'chat', ask({ question: '  ' })), 400);
  const long = Array.from({ length: 17 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: 'x' }));
  assert.equal(await status(learner, 'chat', ask({ question: 'q', history: long })), 400);
  assert.equal(await status(learner, 'chat', ask({ question: 'q', history: [{ role: 'system', text: 'x' }] })), 400);
});

void test('chat after an AC: the solution is open, short snippets survive', async () => {
  const learner: Person = { ...me, id: 'ai-chat-ac', email: 'ai-chat-ac@example.test' };
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,mode,created_at,updated_at)
      VALUES('ai-chat-ac1',?,'lc-1','python','x','accepted',2,2,'judge',10,10)`,
    )
    .run(learner.id);
  reply = ok('Use a map:\n```python\nseen = {}\n```');
  const answer = await body(await call(learner, 'chat', ask({ question: 'What is the optimal approach?' })));
  assert.equal(String(answer.text).includes('seen = {}'), true);
  assert.equal(sent[0].body.system, CHAT_SOLVED);
});

void test('tests: JSON cases checked against the box format, at most five, never code', async () => {
  const learner: Person = { ...me, id: 'ai-tests', email: 'ai-tests@example.test' };
  const cases = (list: { input: string; why: string }[]) => ok(JSON.stringify({ cases: list }));
  // LeetCode mode for Two Sum: one JSON value per line, two lines (nums, target).
  reply = cases([
    { input: '[3,3]\n6', why: 'Duplicates that sum to the target.' },
    { input: '[3,3]\n6', why: 'A repeat is dropped.' },
    { input: '[1,2]', why: 'One line is not two parameters.' },
    { input: 'nums = [1]\ntarget = 1', why: 'Not JSON.' },
    { input: '  [-1,-2,-3]  \n\n-5\n', why: 'Negatives; blank lines and spaces are tidied.' },
  ]);
  const response = await call(learner, 'tests', ask());
  assert.equal(response.status, 200);
  const answer = (await response.json()) as { cases: { input: string; why: string }[]; remaining: number };
  assert.deepEqual(
    answer.cases.map((c) => c.input),
    ['[3,3]\n6', '[-1,-2,-3]\n-5'],
  );
  assert.equal(answer.remaining, AI_DAILY_LIMITS.tests - 1);
  const [{ body: request }] = sent;
  assert.equal(request.model, 'claude-sonnet-5-5');
  const config = request.output_config as { format?: { type: string } };
  assert.equal(config.format?.type, 'json_schema');
  const prompt = userTurns()[0].content;
  assert.equal(prompt.includes('2 line(s), in parameter order: nums, target'), true);
  assert.equal(prompt.includes('HIDDEN-CASE-INPUT'), false);
  // ACM: raw stdin, any non-empty text; nothing usable is a failed (but spent) call.
  sent = [];
  reply = cases([{ input: '3\n1 2 3', why: 'Small.' }]);
  const acm = (await body(await call(learner, 'tests', ask({ codingMode: 'acm' })))) as { cases: { input: string }[] };
  assert.deepEqual(acm.cases, [{ input: '3\n1 2 3\n', why: 'Small.' }]);
  assert.equal(userTurns()[0].content.includes('The complete standard input'), true);
  reply = ok('not json');
  assert.equal(await status(learner, 'tests', ask()), 503);
  reply = cases([{ input: '[1]', why: 'Wrong shape.' }]);
  assert.equal(await status(learner, 'tests', ask()), 503);
  assert.equal(used(learner.id, 'tests'), 4);
});

void test('tests: the box format comes from the Solution method, and a Codec tree is one line', () => {
  // ListNode/TreeNode stubs above `class Solution` have their own __init__ defs.
  const list = caseFormat('lc-206', 'leetcode');
  assert.equal(list.describe.includes('1 line(s), in parameter order: head.'), true);
  assert.equal(list.parse('[1,2,3]'), '[1,2,3]');
  const tree = caseFormat('lc-104', 'leetcode');
  assert.equal(tree.describe.includes('in parameter order: root.'), true);
  assert.equal(tree.parse('[3,9,20,null,null,15,7]'), '[3,9,20,null,null,15,7]');
  assert.equal(caseFormat('lc-21', 'leetcode').describe.includes('list1, list2.'), true);
  for (const id of ['lc-297', 'lc-449']) {
    const codec = caseFormat(id, 'leetcode');
    assert.equal(codec.describe.startsWith('One line'), true);
    assert.equal(codec.parse(' [1,2,3,null,4] \n'), '[1,2,3,null,4]');
    assert.equal(codec.parse('["Codec","roundTrip"]\n[[],[[1]]]'), null);
    assert.equal(codec.parse('{"a":1}'), null);
  }
});

void test('tests: an input shaped like code, prose or a long dump is dropped', () => {
  const acm = caseFormat('lc-1', 'acm').parse;
  const kept = (input: string) => parseCases(JSON.stringify({ cases: [{ input, why: 'x' }] }), acm).length === 1;
  assert.equal(kept('4\n2 7 11 15\n9'), true);
  assert.equal(kept('["a==b","b!=a"]'), true);
  assert.equal(kept('"()[]{}"'), true);
  assert.equal(kept('def twoSum(self, nums, target):\n    seen = {}'), false);
  assert.equal(kept('for i, x in enumerate(nums)'), false);
  assert.equal(kept('#include <bits/stdc++.h>'), false);
  assert.equal(kept('int main() { return 0; }'), false);
  assert.equal(kept('func twoSum(nums []int) []int'), false);
  assert.equal(kept('用哈希表'), false);
  assert.equal(kept('1 '.repeat(301)), false);
  assert.equal(kept(Array.from({ length: 21 }, (_, i) => String(i)).join('\n')), false);
});

void test('debug: verdict and public data only; a hidden failing case gives its verdict alone', async () => {
  const learner: Person = { ...me, id: 'ai-debug', email: 'ai-debug@example.test' };
  const db = sqlite();
  // Nothing failed yet: no call.
  assert.equal(await status(learner, 'debug', ask()), 409);
  const insert = db.prepare(
    `INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,mode,created_at,updated_at,problem_version_id,custom_input,message)
    VALUES(?,?,'lc-1','python','x',?,?,2,?,?,?,?,?,?)`,
  );
  const result = db.prepare(
    'INSERT INTO oj_results(submission_id,ordinal,status,runtime_ms,memory_kb,stdout,stderr,hidden) VALUES(?,?,?,1,1,?,?,?)',
  );
  // A formal submission that fails on the hidden case (whose output the judge did capture).
  insert.run('ai-d1', learner.id, 'wrong_answer', 1, 'judge', 20, 20, version, null, null);
  result.run('ai-d1', 0, 'accepted', '1\n', '', 0);
  result.run('ai-d1', 1, 'wrong_answer', 'HIDDEN-STDOUT', '', 1);
  reply = ok('Look at `range(n)` when the list is empty.');
  const answer = await body(await call(learner, 'debug', ask()));
  assert.equal(String(answer.text).includes('range(n)'), true);
  let prompt = userTurns()[0].content;
  assert.equal(prompt.includes('<failure>'), true);
  assert.equal(prompt.includes('Wrong answer, 1/2'), true);
  assert.equal(prompt.includes('is hidden'), true);
  assert.equal(/HIDDEN-CASE-INPUT|HIDDEN-OUT|HIDDEN-STDOUT/.test(prompt), false);
  assert.equal(sent[0].body.system, SYSTEM.debug);
  // A run on the learner's own input: that input and the program's output go along.
  sent = [];
  insert.run('ai-d2', learner.id, 'runtime_error', 0, 'run', 21, 21, version, 'MY-STDIN\n', null);
  result.run('ai-d2', 0, 'runtime_error', 'partial', 'IndexError: list index out of range', 0);
  await call(learner, 'debug', ask());
  prompt = userTurns()[0].content;
  assert.equal(prompt.includes('custom input') && prompt.includes('MY-STDIN') && prompt.includes('IndexError'), true);
  assert.equal(prompt.includes('Expected output'), false);
});

void test('complexity only after an AC; explain sends the selection, not the code', async () => {
  const learner: Person = { ...me, id: 'ai-cx', email: 'ai-cx@example.test' };
  assert.equal(await status(learner, 'complexity', ask()), 409);
  assert.equal(sent.length, 0);
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,mode,created_at,updated_at)
      VALUES('ai-cx1',?,'lc-1','python','x','accepted',2,2,'judge',30,30)`,
    )
    .run(learner.id);
  reply = ok('**Time** O(n).\n**Space** O(n).\n**Best possible** O(n) time, already reached.');
  const answer = await body(await call(learner, 'complexity', ask()));
  assert.equal(String(answer.text).includes('**Best possible**'), true);
  assert.equal(sent[0].body.system, SYSTEM.complexity);
  assert.equal(await status(learner, 'complexity', ask({ code: ' ' })), 400);
  sent = [];
  reply = ok('It means every index is used at most once.');
  assert.equal(await status(learner, 'explain', ask()), 400);
  const explained = await body(await call(learner, 'explain', ask({ selection: 'you may not use the same element twice' })));
  assert.equal(explained.kind, 'explain');
  const prompt = userTurns()[0].content;
  assert.equal(prompt.includes('<selection>\nyou may not use the same element twice'), true);
  assert.equal(prompt.includes('MY-CODE-MARKER'), false);
  assert.equal(sent[0].body.model, 'claude-haiku-5-5');
  assert.equal(await status(learner, 'explain', ask({ selection: 'x'.repeat(601) })), 400);
});
