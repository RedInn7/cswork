import test from 'node:test';
import assert from 'node:assert/strict';
import { PROBLEM_TEMPLATE, parseNoteMeta, wikiLinks } from '../lib/note-meta';

void test('tags: Chinese and hyphenated, lower-cased and unique; headings, C#, URLs and #12 are not tags', () => {
  const body = [
    '## 关键观察',
    '#双指针 #Off-by-one，#off-by-one',
    '用 C# 写过一遍，C#也行；见 https://example.com/a/#frag 和 [这里](#anchor)',
    '#12 不算，#a 太短，&#39; 也不算',
    `#${'x'.repeat(33)} 太长`,
    '（#单调栈）',
  ].join('\n');
  assert.deepEqual(parseNoteMeta(body).tags, ['双指针', 'off-by-one', '单调栈']);
});

void test('code blocks and inline code are skipped for tags, confidence and links', () => {
  const body = [
    '```python',
    '# comment #notatag [[lc-1]]',
    '把握度: 1',
    '```',
    'Use `#include [[lc-2]]` here #real [[lc-3]]',
    '~~~',
    '#fenced',
    '~~~',
    'Confidence：4',
    '```',
    '#unclosed runs to the end [[lc-9]]',
  ].join('\n');
  assert.deepEqual(parseNoteMeta(body), { tags: ['real'], confidence: 4, links: ['lc-3'] });
});

void test('confidence takes a half- or full-width colon and 1–5 only', () => {
  assert.equal(parseNoteMeta('把握度：3').confidence, 3);
  assert.equal(parseNoteMeta('- confidence: 5/5').confidence, 5);
  assert.equal(parseNoteMeta('把握度: ').confidence, null);
  assert.equal(parseNoteMeta('把握度: 10').confidence, null);
  assert.equal(parseNoteMeta('把握度: 0').confidence, null);
  assert.equal(parseNoteMeta('我的把握度: 2').confidence, null, 'the line starts with it');
  assert.equal(parseNoteMeta(PROBLEM_TEMPLATE.zh).confidence, null);
  assert.deepEqual(parseNoteMeta(PROBLEM_TEMPLATE.en).tags, [], 'the template itself has no tag');
});

void test('links: only [[lc-N]] and [[oa-…]], never a bare [[1,2]]', () => {
  assert.deepEqual(parseNoteMeta('像 [[lc-42]]、[[LC-42]] 和 [[oa-acme-1]]，不是 [[1,2]] 或 [[42]]').links, [
    'lc-42',
    'oa-acme-1',
  ]);
});

void test('wikiLinks turns links into Markdown links outside code only', () => {
  assert.equal(
    wikiLinks('see [[lc-42]] and `[[lc-1]]`\n```\n[[lc-2]]\n```\n[[1,2]] [[oa-acme-1]]'),
    'see [lc-42](/?view=problem&problem=lc-42) and `[[lc-1]]`\n```\n[[lc-2]]\n```\n[[1,2]] [oa-acme-1](/?view=problem&problem=oa-acme-1)',
  );
  assert.equal(wikiLinks('no links'), 'no links');
});

void test('the template keeps the fixed headings note-export reads', () => {
  assert.match(PROBLEM_TEMPLATE.zh, /^## 关键观察$/m);
  assert.match(PROBLEM_TEMPLATE.en, /^## Key observation$/m);
  for (const t of [PROBLEM_TEMPLATE.zh, PROBLEM_TEMPLATE.en]) assert.equal(t.match(/^## /gm)?.length, 8);
});

void test('a hostile note parses in linear time (no regex backtracking blow-up)', () => {
  let ticks = '';
  for (let i = 1; ticks.length < 20000; i++) ticks += '`'.repeat(i) + 'x';
  for (const body of ['a'.repeat(20000), ticks, '](](](['.repeat(4000), '`'.repeat(10000) + 'a'.repeat(10000)]) {
    const start = performance.now();
    parseNoteMeta(body);
    wikiLinks(body);
    assert.ok(performance.now() - start < 50, `${body.slice(0, 12)}… took ${performance.now() - start} ms`);
  }
  // Still code and still URLs: spans of any delimiter length, and fragments after a scheme.
  assert.deepEqual(parseNoteMeta('``#a1`` `#b2` #c3 http://x.y/#d4 [x](#e5)').tags, ['c3']);
});
