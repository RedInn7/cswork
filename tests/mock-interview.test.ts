import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import {
  KINDS,
  TEMPLATES,
  companyCounts,
  drawSet,
  leadershipPrinciples,
  resolveTemplate,
  splitBody,
  type PoolItem,
} from '../lib/mock-interview';
import { mockPool, mockSet } from '../lib/server/mock-interview';

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
    assert.ok(t.slots.length >= 3 && t.slots.every((s) => Object.hasOwn(KINDS, s.kind) && s.minutes > 0), t.id);
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
  const previous = process.env.HIDDEN_COMPANIES;
  process.env.HIDDEN_COMPANIES = 'secretco';
  try {
    const found = mockPool(db);
    assert.deepEqual(found.map((r) => r.id), ['cq-dup', 'iq-ok']);
    assert.equal(found[0].problem, 'lc-1');
    const set = mockSet(db, new URLSearchParams('template=custom&mix=behavioral.1&company=amazon&seed=a1'));
    assert.equal(set.slots[0].item?.id, 'iq-ok');
    assert.equal(set.slots[0].item?.question, 'Tell me about Ownership.');
    assert.equal(set.slots[0].item?.solution, 'Use STAR.');
    assert.deepEqual(set.slots[0].item?.principles, ['Ownership']);
    assert.throws(() => mockSet(db, new URLSearchParams('template=nope')), { status: 400 });
    assert.throws(() => mockSet(db, new URLSearchParams('template=phone&seed=a%20b')), { status: 400 });
  } finally {
    if (previous === undefined) delete process.env.HIDDEN_COMPANIES;
    else process.env.HIDDEN_COMPANIES = previous;
  }
});
