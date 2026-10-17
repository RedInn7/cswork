import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import {
  FRAMEWORKS,
  KINDS,
  TEMPLATES,
  companyCounts,
  drawSet,
  frameworkFor,
  guideFor,
  leadershipPrinciples,
  resolveTemplate,
  splitBody,
  type KindId,
  type PoolItem,
  type Text,
} from '../lib/mock-interview';
import { mockPool, mockSet } from '../lib/server/mock-interview';
import { extraPool, extraQuestion } from '../lib/server/interview-extra';
import { sqlite } from '../db/sqlite';
import type { Person } from '../lib/server/auth';

const q = (id: string, company: string | null, category: string, role = 'Software Engineer', round = 'Onsite'): PoolItem => ({
  id, company, category, role, round,
});
const CODING = 'Coding & Algorithms',
  BQ = 'Behavioral & Leadership';
const pool: PoolItem[] = [
  q('meta-1', 'meta', CODING), q('meta-2', 'meta', CODING), q('meta-3', 'meta', CODING), q('fb-1', 'facebook', CODING),
  q('meta-ds', 'meta', CODING, 'Data Scientist'),
  ...Array.from({ length: 20 }, (_, i) => q(`uber-${i}`, 'uber', CODING, 'Software Engineer', i % 2 ? 'Onsite' : 'Technical Screen')),
  q('tiktok-1', 'tiktok', CODING), q('bytedance-1', 'bytedance', CODING),
  q('bq-meta-1', 'meta', BQ, 'Data Scientist'), q('bq-meta-2', 'meta', BQ, 'Data Scientist'),
  ...Array.from({ length: 4 }, (_, i) => q(`bq-stripe-${i}`, 'stripe', BQ)),
];
const custom = (mix: string) => resolveTemplate('custom', mix)!;
const ids = (set: ReturnType<typeof drawSet>) => set.slots.map((s) => s.item?.id ?? null);

void test('templates are well formed and custom mixes are validated', () => {
  assert.equal(new Set(TEMPLATES.map((t) => t.id)).size, TEMPLATES.length);
  for (const t of TEMPLATES) {
    // A rapid slot is that many questions.
    const questions = t.slots.reduce((n, s) => n + (s.rapid ?? 1), 0);
    assert.ok(questions >= 3 && t.slots.every((s) => Object.hasOwn(KINDS, s.kind) && s.minutes > 0), t.id);
    const total = t.slots.reduce((sum, s) => sum + s.minutes, 0);
    assert.ok(total >= 30 && total <= 180, `${t.id}: ${total} minutes`);
  }
  const phone = resolveTemplate('phone')!;
  assert.ok(phone.slots.filter((s) => s.kind === 'coding').length >= 1 && phone.slots.some((s) => s.kind === 'behavioral'));
  const mix = resolveTemplate('custom', 'coding.2-behavioral.1', '60')!;
  assert.deepEqual(mix.slots.map((s) => s.kind), ['coding', 'coding', 'behavioral']);
  assert.ok(Math.abs(mix.slots.reduce((sum, s) => sum + s.minutes, 0) - 60) <= 2);
  for (const [m, min] of [['coding.6', null], ['nope.1', null], ['', null], ['coding.0', null], ['coding.5-sql.4', null], ['coding.1', '5'], ['coding.1', '1.5']])
    assert.equal(resolveTemplate('custom', m, min), null, `${m} ${min}`);
  assert.equal(resolveTemplate('constructor'), null);
});

void test('the company and its aliases come first, then the same role elsewhere, marked similar', () => {
  const set = drawSet(pool, custom('coding.5'), { seed: 's1', company: 'meta', role: 'swe' });
  assert.deepEqual(ids(set).slice(0, 4).sort(), ['fb-1', 'meta-1', 'meta-2', 'meta-3']);
  assert.ok(set.slots.slice(0, 4).every((s) => !s.similar));
  // Coding: the role outranks the company, so another company's SWE question beats Meta's DS one.
  assert.equal(set.slots[4].item?.role, 'Software Engineer');
  assert.ok(set.slots[4].similar);
  // Behavioral: the company outranks the role.
  const bq = drawSet(pool, custom('behavioral.3'), { seed: 's1', company: 'meta', role: 'swe' });
  assert.deepEqual(ids(bq).slice(0, 2).sort(), ['bq-meta-1', 'bq-meta-2']);
  assert.ok(bq.slots[2].similar && bq.slots[2].item?.company === 'stripe');
  assert.deepEqual(ids(drawSet(pool, custom('coding.2'), { seed: 'x', company: 'tiktok' })).sort(), ['bytedance-1', 'tiktok-1']);
  // The round is preferred within a company.
  const onsite = drawSet(pool, custom('coding.5'), { seed: 'r', company: 'uber', round: 'Onsite' });
  assert.ok(onsite.slots.every((s) => s.item?.company === 'uber' && s.item.round === 'Onsite'));
});

void test('a seed reproduces its set; re-rolls and exclusions replay from seed + rerolls', () => {
  const template = custom('coding.3-behavioral.2');
  const first = drawSet(pool, template, { seed: 'abc' });
  assert.deepEqual(ids(drawSet(pool, template, { seed: 'abc' })), ids(first));
  assert.ok(['b', 'c', 'd', 'e'].some((seed) => ids(drawSet(pool, template, { seed })).join() !== ids(first).join()));
  assert.equal(new Set(ids(first)).size, 5);

  const rolled = drawSet(pool, template, { seed: 'abc', rerolls: [1, 9, -1] });
  assert.deepEqual(rolled.rerolls, [1]); // out-of-range slots are ignored
  assert.notEqual(rolled.slots[1].item?.id, first.slots[1].item?.id);
  assert.deepEqual(ids(rolled).filter((_, i) => i !== 1), ids(first).filter((_, i) => i !== 1));
  assert.equal(new Set(ids(rolled)).size, 5);

  const exclude = ids(first) as string[];
  const fresh = drawSet(pool, template, { seed: 'abc', exclude });
  assert.ok(ids(fresh).every((id) => id && !exclude.includes(id)));
  assert.deepEqual(ids(drawSet(pool, template, { seed: 'abc', rerolls: fresh.rerolls })), ids(fresh));
  // A re-roll with nothing left keeps the question instead of looping.
  const tiny = drawSet([q('only', null, BQ)], custom('behavioral.1'), { seed: 'abc', rerolls: [0], exclude: ['only'] });
  assert.deepEqual([ids(tiny), tiny.rerolls], [['only'], []]);
});

void test('two versions of one judge problem never share a set', () => {
  const twins: PoolItem[] = [
    { ...q('lru-a', 'meta', CODING), problem: 'lc-146' },
    { ...q('lru-b', 'tiktok', CODING), problem: 'lc-146' },
    { ...q('lru-c', 'meta', CODING), problem: 'lc-146' },
    { ...q('sum', 'meta', CODING), problem: 'lc-1' },
    ...Array.from({ length: 6 }, (_, i) => q(`uber-${i}`, 'uber', CODING)),
  ];
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
    for (const rerolls of [[], [0], [1, 0, 2, 1, 0]]) {
      const set = drawSet(twins, custom('coding.3'), { seed, company: 'meta', rerolls });
      const picked = ids(set),
        lru = picked.filter((id) => id?.startsWith('lru-')).length;
      // Meta's own LRU and Two Sum first, then another company fills the slot the second LRU would take.
      assert.ok(rerolls.length ? lru <= 1 : lru === 1 && picked.includes('sum'), `${seed} ${rerolls}: ${picked}`);
      assert.ok(picked.every(Boolean) && new Set(picked).size === 3, `${seed} ${rerolls}`);
    }
  }
});

void test('optional slots need a bank; counts merge aliases', () => {
  const onsite = drawSet(pool, resolveTemplate('onsite')!, { seed: 'o' });
  assert.ok(!onsite.slots.some((s) => s.kind === 'design'));
  assert.equal(onsite.slots.length, 4);
  const withDesign = drawSet([...pool, q('sd', 'openai', 'System Design')], resolveTemplate('onsite')!, { seed: 'o' });
  assert.equal(withDesign.slots.find((s) => s.kind === 'design')?.pool, 1);
  const counts = companyCounts([
    { ...q('a', 'tiktok', CODING), companyName: 'TikTok' },
    { ...q('b', 'bytedance', BQ), companyName: 'ByteDance' },
    { ...q('c', 'uber', CODING), companyName: 'Uber' },
  ]);
  assert.deepEqual(counts[0], { slug: 'tiktok', n: 2, kinds: { coding: 1, behavioral: 1 }, name: 'TikTok / ByteDance' });
});

const body = `# Rate limiter

Implement \`allow(ip, t)\`.

\`\`\`python
# Hints in a code comment stay in the question
def allow(ip, t): ...
\`\`\`

### Constraints
- n <= 10^5

### Hints
1. Keep a queue per IP.

### What a Strong Answer Covers
- Amortised O(1).

## Part 2: Many servers

Now share the limit.

### Hints
- Think about clocks.

### Follow-up Questions
- What if a server dies?

### Approach
Sliding window log.

---

## Solution

### Solution Alignment
Use a deque.`;

void test('a body splits into the candidate part and the interviewer notes', () => {
  const parts = splitBody(body);
  assert.match(parts.question, /^# Rate limiter/);
  assert.match(parts.question, /# Hints in a code comment/);
  assert.match(parts.question, /### Constraints\n- n <= 10\^5/);
  assert.match(parts.question, /## Part 2: Many servers\n\nNow share the limit\.$/);
  assert.doesNotMatch(parts.question, /queue per IP|Amortised|clocks|server dies|deque|Sliding/);
  assert.equal(parts.hints, '1. Keep a queue per IP.\n\n**Part 2: Many servers**\n\n- Think about clocks.');
  assert.equal(parts.followUps, '**Part 2: Many servers**\n\n- What if a server dies?');
  assert.equal(parts.rubric, '#### What a Strong Answer Covers\n- Amortised O(1).');
  assert.match(parts.solution, /^\*\*Part 2: Many servers\*\*\n\n#### Approach\nSliding window log\.\n\n### Solution Alignment\nUse a deque\.$/);
  // A title that looks like a section is still the question; no solution means none.
  assert.deepEqual(splitBody('# Follow-up email\nWrite it.'), {
    question: '# Follow-up email\nWrite it.', hints: '', followUps: '', rubric: '', solution: '',
  });
  // Quoted hints and grading notes in the question are the interviewer's too; a quote in code stays.
  const quoted = splitBody(`Sort it.

> **Hint: Use a heap**
>
> Pop the smallest.

\`\`\`text
> **Hint: in code stays**
\`\`\`

### Part 2

More.

> **Hint** Two heaps.

### Evaluation Focus
- O(n log n).

### Extensions to Discuss
1. Streams?`);
  assert.deepEqual(quoted, {
    question: 'Sort it.\n\n```text\n> **Hint: in code stays**\n```\n\n### Part 2\n\nMore.',
    hints: '**Hint: Use a heap**\n\nPop the smallest.\n\n**Part 2**\n\n**Hint** Two heaps.',
    followUps: '1. Streams?',
    rubric: '#### Evaluation Focus\n- O(n log n).',
    solution: '',
  });
  assert.deepEqual(leadershipPrinciples('Tell me about a time you showed Ownership and had to Dive Deep; disagree and commit.'), [
    'Ownership', 'Dive Deep', 'Disagree and Commit',
  ]);
});

void test('the server pool never holds partial or hidden questions and keeps judgeable duplicates', () => {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE items(id TEXT PRIMARY KEY, type TEXT, slug TEXT, title TEXT, company_slug TEXT, company_name TEXT,
    role TEXT, category TEXT, difficulty TEXT, round TEXT, partial INTEGER, listed INTEGER, dup_of TEXT, extra TEXT, body TEXT)`);
  const insert = db.prepare('INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const row = (id: string, company: string, o: { partial?: number; listed?: number; dup?: object; category?: string } = {}) =>
    insert.run(id, 'interview_question', id, `Title ${id}`, company, company.toUpperCase(), 'Software Engineer', o.category ?? BQ,
      'medium', 'Onsite', o.partial ?? 0, o.listed ?? 1, o.dup ? JSON.stringify(o.dup) : null, '{}',
      `Tell me about Ownership.\n\n## Solution\n\nUse STAR.`);
  row('iq-ok', 'amazon');
  row('iq-partial', 'amazon', { partial: 1 });
  row('iq-hidden', 'secretco');
  row('iq-unlisted', 'amazon', { listed: 0 });
  row('cq-dup', 'uber', { listed: 0, category: CODING, dup: { kind: 'library', id: 'lc-1', problem: 'lc-1' } });
  row('cq-dup-hidden', 'uber', { listed: 0, category: CODING, dup: { kind: 'oa', id: 'oa-secretco-1', problem: 'oa-secretco-1' } });
  // A listed coding question company-lc-map pairs with LeetCode 322.
  insert.run('cq-coin', 'coding_question', 'solve-decimal-coin-change', 'Coin change', 'airbnb', 'Airbnb', 'Software Engineer',
    CODING, 'medium', 'Onsite', 0, 1, null, '{}', 'Make change.');
  const previous = process.env.HIDDEN_COMPANIES;
  process.env.HIDDEN_COMPANIES = 'secretco';
  try {
    const found = mockPool(db);
    assert.deepEqual(found.map((r) => r.id), ['cq-coin', 'cq-dup', 'iq-ok']);
    assert.equal(found[0].problem, 'lc-322');
    assert.equal(found[1].problem, 'lc-1');
    assert.equal(found[2].problem, null);
    const set = mockSet(db, new URLSearchParams('template=custom&mix=behavioral.1&company=amazon&seed=a1'));
    assert.equal(set.slots[0].item?.id, 'iq-ok');
    assert.equal(set.slots[0].item?.question, 'Tell me about Ownership.');
    assert.equal(set.slots[0].item?.solution, 'Use STAR.');
    assert.deepEqual(set.slots[0].item?.principles, ['Ownership']);
    const candidate = mockSet(db, new URLSearchParams('template=custom&mix=behavioral.1&company=amazon&seed=a1&parts=question'));
    assert.equal(candidate.slots[0].item?.question, 'Tell me about Ownership.');
    assert.equal(candidate.slots[0].item?.solution, '');
    assert.throws(() => mockSet(db, new URLSearchParams('template=nope')), { status: 400 });
    assert.throws(() => mockSet(db, new URLSearchParams('template=phone&seed=a%20b')), { status: 400 });
  } finally {
    if (previous === undefined) delete process.env.HIDDEN_COMPANIES;
    else process.env.HIDDEN_COMPANIES = previous;
  }
});

void test('the project, API and frontend banks: enough bilingual questions, API ones read their course chapter', () => {
  const frontend = extraPool('frontend');
  assert.ok(frontend.length >= 10, `${frontend.length} frontend questions`);
  for (const category of KINDS.frontend.categories)
    assert.ok(frontend.filter((r) => r.category === category).length >= 5, category);
  assert.equal(extraPool('api').length, 5);
  assert.deepEqual(extraPool('project').map((r) => r.id), ['project-deep-dive']);
  assert.deepEqual(extraPool('coding'), []);
  const all = (['project', 'api', 'frontend'] as const).flatMap(extraPool);
  assert.equal(new Set(all.map((r) => r.id)).size, all.length);
  for (const row of all) {
    const q = extraQuestion(row.id)!;
    assert.ok(KINDS[q.kind].categories.includes(q.category), row.id);
    assert.match(q.titleZh + q.questionZh, /[一-鿿]/, row.id);
    assert.doesNotMatch(q.title + q.question, /[一-鿿]/, row.id);
    // The project deep dive has no reference: the candidate's own resume is the material.
    assert.ok(q.rubric && (q.kind === 'project' || q.solution.length > 500), row.id);
  }
  assert.match(extraQuestion('api-payments')!.solution, /Idempotency/);
  assert.equal(extraQuestion('lc-1'), null);
});

void test('the AI-only extra templates draw their own questions, the frontend round one of each category', () => {
  assert.equal(resolveTemplate('custom', 'frontend.1'), null);
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE items(id TEXT PRIMARY KEY, type TEXT, slug TEXT, title TEXT, company_slug TEXT, company_name TEXT,
    role TEXT, category TEXT, difficulty TEXT, round TEXT, partial INTEGER, listed INTEGER, dup_of TEXT, extra TEXT, body TEXT)`);
  for (const [template, kinds, minutes] of [['project', ['project'], 30], ['api', ['api'], 40], ['frontend', ['frontend', 'frontend'], 45]] as const) {
    const t = resolveTemplate(template)!;
    assert.ok(t.slots.every((s) => KINDS[s.kind].aiOnly), template);
    assert.equal(t.slots.reduce((n, s) => n + s.minutes, 0), minutes, template);
    const set = mockSet(db, new URLSearchParams({ template, seed: 'abc' }));
    assert.deepEqual(set.slots.map((s) => s.kind), kinds);
    for (const { item } of set.slots) {
      assert.ok(item && item.question && item.questionZh && item.titleZh, template);
      // Hints, rubric and the reference stay on the server.
      assert.equal(item.hints + item.followUps + item.rubric + item.solution, '', template);
    }
  }
  const frontend = mockSet(db, new URLSearchParams({ template: 'frontend', seed: 'abc' }));
  assert.deepEqual(frontend.slots.map((s) => s.item?.category), ['Frontend', 'Frontend Components']);
  assert.ok(frontend.slots.every((s) => s.pool >= 5));
  // A re-roll stays in its slot's category.
  const rolled = mockSet(db, new URLSearchParams({ template: 'frontend', seed: 'abc', rr: '1' }));
  assert.equal(rolled.slots[1].item?.category, 'Frontend Components');
  assert.notEqual(rolled.slots[1].item?.id, frontend.slots[1].item?.id);
  // Other templates never draw them.
  assert.ok(mockSet(db, new URLSearchParams({ template: 'lld', seed: 'abc' })).slots.every((s) => s.item?.type !== 'extra'));
});

void test('answer frameworks: picked by kind and title, steps scaled to add up to the slot', () => {
  const f = (kind: KindId, title: string, category: string | null = null, minutes = 15, parts?: { q: Text }[]) =>
    frameworkFor({ kind, minutes }, { title, category, parts });
  const ids = (steps: ReturnType<typeof frameworkFor>) => steps?.map((s) => s.id) ?? null;
  assert.deepEqual(ids(f('analytics', 'Design an A/B test for a new checkout button')), FRAMEWORKS.ab.map((s) => s.id));
  assert.equal(f('analytics', 'How would you run the experiment for free shipping?')?.[0].id, 'hypothesis');
  assert.deepEqual(ids(f('analytics', 'Daily active users dropped 10% overnight')), FRAMEWORKS.metric.map((s) => s.id));
  assert.equal(f('analytics', 'Investigate a spike in support tickets')?.[0].id, 'define');
  assert.equal(f('analytics', 'Bookings are declining in Europe')?.[0].id, 'define');
  assert.equal(f('analytics', 'How would you measure the success of Stories?'), null);
  assert.deepEqual(ids(f('ml', 'Design a news feed ranking model', null, 20)), FRAMEWORKS.mldesign.map((s) => s.id));
  assert.equal(f('ml', 'Build a model to recommend restaurants')?.[0].id, 'goal');
  assert.equal(f('ml', 'Explain the bias-variance trade-off'), null);
  assert.equal(f('design', 'Design a URL shortener', 'System Design', 45)?.length, 5);
  assert.equal(f('design', 'TCP vs UDP', 'Software Engineering Fundamentals'), null);
  assert.equal(f('behavioral', 'Tell me about an A/B test that failed'), null);
  assert.equal(f('coding', 'Two Sum', null, 35), null);
  assert.equal(f('coding', 'Two Sum', null, 35, []), null);
  assert.equal(frameworkFor({ kind: 'analytics', minutes: 15 }, null), null);
  // A multi-part coding question: the question, then one step per follow-up, which is its text.
  const parts = f('coding', 'Two Sum', null, 35, [{ q: ['如果数组已经排好序？', 'What if the array is sorted?'] }, { q: ['三个数呢？', 'And three numbers?'] }])!;
  assert.deepEqual(parts.map((s) => [s.id, s.minutes]), [['part-1', 17], ['part-2', 9], ['part-3', 9]]);
  assert.deepEqual(parts[1].points, ['如果数组已经排好序？', 'What if the array is sorted?']);
  assert.deepEqual(parts[2].name, ['第 3 部分', 'Part 3']);
  // The defaults fit each kind's suggested minutes; any slot length is shared out exactly, on half minutes.
  assert.deepEqual([FRAMEWORKS.metric, FRAMEWORKS.ab, FRAMEWORKS.mldesign].map((x) => x.reduce((n, s) => n + s.minutes, 0)), [15, 15, 20]);
  for (const minutes of [3, 10, 15, 20, 26, 35, 45, 60]) {
    for (const steps of [f('analytics', 'A/B test', null, minutes), f('analytics', 'Revenue fell', null, minutes), f('ml', 'Design a ranker', null, minutes),
      f('design', 'Design a chat app', 'System Design', minutes), f('coding', 'x', null, minutes, [{ q: ['a', 'a'] }])]) {
      assert.equal(steps!.reduce((n, s) => n + s.minutes, 0), minutes, `${steps![0].id} ${minutes}`);
      assert.ok(steps!.every((s) => s.minutes > 0 && Number.isInteger(s.minutes * 2)), `${steps![0].id} ${minutes}`);
    }
  }
  // Every step is bilingual and scored on a dimension of its round.
  for (const steps of Object.values(FRAMEWORKS))
    for (const s of steps) {
      assert.match(s.name[0] + s.points[0], /[一-鿿]/, s.id);
      assert.doesNotMatch(s.name[1] + s.points[1], /[一-鿿]/, s.id);
      assert.ok(s.rubric.length > 0, s.id);
    }
  // The AI interviewer's own guide is unchanged: analytics questions have none there.
  assert.equal(guideFor('analytics', 'Analytics & Experimentation'), null);
  assert.equal(guideFor('design', 'System Design')?.length, 5);
});

void test('the rapid-fire screen: eight different fundamentals at 90 seconds each, then a multi-part coding question', () => {
  const FUNDAMENTALS = 'Software Engineering Fundamentals';
  const bank: PoolItem[] = [
    ...Array.from({ length: 12 }, (_, i) => q(`f-${i}`, null, FUNDAMENTALS)),
    q('sd-1', null, 'System Design'),
    ...Array.from({ length: 6 }, (_, i) => q(`c-${i}`, null, CODING)),
    { ...q('c-parts-1', null, CODING), parts: true },
    { ...q('c-parts-2', null, CODING), parts: true },
  ];
  const template = resolveTemplate('screen-rapid')!;
  assert.ok(TEMPLATES.includes(template));
  // A generic name: the format is common to many technical screens.
  assert.doesNotMatch(JSON.stringify(template), /karat/i);
  for (const seed of ['a', 'b', 'c', 'd']) {
    const set = drawSet(bank, template, { seed });
    assert.equal(set.slots.length, 9);
    const rapid = set.slots.slice(0, 8);
    assert.ok(rapid.every((s) => s.item?.category === FUNDAMENTALS && s.minutes === 1.5 && s.rapid === 8), seed);
    assert.equal(new Set(rapid.map((s) => s.item!.id)).size, 8, seed);
    assert.deepEqual(rapid.map((s) => s.name), Array.from({ length: 8 }, (_, k) => [`快问快答 ${k + 1}/8`, `Rapid-fire ${k + 1}/8`]));
    assert.match(set.slots[8].item!.id, /^c-parts-/, seed);
    assert.equal(set.slots[8].parts, true);
    assert.equal(set.slots[8].pool, 2);
    // A re-roll stays among the questions with follow-ups; one of the rapid ones, among the fundamentals.
    const rolled = drawSet(bank, template, { seed, rerolls: [8, 3] });
    assert.match(rolled.slots[8].item!.id, /^c-parts-/);
    assert.notEqual(rolled.slots[8].item!.id, set.slots[8].item!.id);
    assert.equal(new Set(rolled.slots.slice(0, 8).map((s) => s.item!.id)).size, 8);
  }
  // No question with follow-ups: any coding question.
  const plain = drawSet(bank.filter((i) => !i.parts), template, { seed: 'a' });
  assert.match(plain.slots[8].item!.id, /^c-\d$/);
  assert.equal(plain.slots[8].pool, 6);
});

void test('a parts slot carries up to two follow-up questions, never their answers, and none in a running contest or exam', () => {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE items(id TEXT PRIMARY KEY, type TEXT, slug TEXT, title TEXT, company_slug TEXT, company_name TEXT,
    role TEXT, category TEXT, difficulty TEXT, round TEXT, partial INTEGER, listed INTEGER, dup_of TEXT, extra TEXT, body TEXT)`);
  const insert = db.prepare('INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  // Two Sum (lc-1) has written follow-ups; lc-2 has none.
  insert.run('cq-sum', 'coding_question', 'two-sum-x', 'Two sum', 'uber', 'Uber', 'Software Engineer', CODING, 'easy', 'Onsite', 0, 0,
    JSON.stringify({ kind: 'library', id: 'lc-1', problem: 'lc-1' }), '{}', 'Find two numbers.\n\n## Solution\n\nHash map.');
  insert.run('cq-add', 'coding_question', 'add-two-x', 'Add two numbers', 'uber', 'Uber', 'Software Engineer', CODING, 'medium', 'Onsite', 0, 0,
    JSON.stringify({ kind: 'library', id: 'lc-2', problem: 'lc-2' }), '{}', 'Add them.');
  assert.deepEqual(mockPool(db).map((r) => [r.id, r.parts]), [['cq-add', false], ['cq-sum', true]]);
  const coding = (p: Person | null = null, extra = '') => mockSet(db, new URLSearchParams(`template=screen-rapid&seed=a1${extra}`), p).slots[8].item!;
  const item = coding();
  assert.equal(item.id, 'cq-sum');
  assert.deepEqual(item.parts, [
    { q: ['如果数组已经排好序？', 'What if the array is sorted?'] },
    { q: ['要返回所有和为 target 的数对（按值去重）？', 'Return every pair summing to target, without duplicate values?'] },
  ]);
  assert.ok(item.parts!.every((part) => Object.keys(part).join() === 'q'));
  assert.doesNotMatch(JSON.stringify(item.parts), /pointer|指针/i);
  // The candidate's view gets the questions too (they hold no answers); other slots get none.
  assert.equal(coding(null, '&parts=question').parts?.length, 2);
  assert.ok(mockSet(db, new URLSearchParams('template=custom&mix=coding.2&seed=a1')).slots.every((s) => !s.item?.parts));

  // Signed in with Two Sum in a running skill exam: no follow-ups; anyone else still gets them.
  process.env.DATABASE_PATH = resolve(mkdtempSync(resolve(tmpdir(), 'cswork-mock-parts-')), 'test.sqlite');
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
  const now = Date.now();
  sqlite()
    .prepare("INSERT INTO skill_attempts(id,user_id,test,ids_json,language,started_at,deadline,created_at) VALUES('exam','u-exam','dsa','[\"lc-1\"]','python',?,?,0)")
    .run(now - 60_000, now + 3_600_000);
  const person = (id: string): Person => ({ id, name: id, email: `${id}@example.test`, role: 'student', verified: true });
  assert.equal(coding(person('u-exam')).id, 'cq-sum');
  assert.equal(coding(person('u-exam')).parts, undefined);
  assert.equal(coding(person('u-other')).parts?.length, 2);
});
