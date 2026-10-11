import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { register } from 'node:module';
register(
  `data:text/javascript,${encodeURIComponent("export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'export default {}',shortCircuit:true};return n(u,c);}")}`,
  import.meta.url,
);
const { FeedTable, mergeFeed, relativeTime } = await import('../components/judge-status.tsx');

const item = (seq, extra = {}) => ({
  seq,
  run: `run${seq}`.padEnd(8, '0'),
  problemId: 'lc-1',
  source: { kind: 'library' },
  user: 'alice',
  mine: false,
  language: 'python',
  status: 'accepted',
  passed: 28,
  total: 28,
  runtimeMs: 42,
  memoryKb: 9216,
  codeBytes: 2048,
  createdAt: 1_000_000,
  ...extra,
});

test('the table shows verdicts, the viewer badge and OA companies without links for unknown problems', () => {
  const html = renderToStaticMarkup(
    createElement(FeedTable, {
      items: [
        item(3, { status: 'running', passed: 12, mine: true }),
        item(2, {
          status: 'wrong_answer',
          passed: 3,
          problemId: 'oa-amazon-1',
          source: { kind: 'oa', company: { slug: 'amazon', name: 'Amazon' } },
          language: 'cpp',
        }),
        item(1, { problemId: 'gone-problem' }),
      ],
      titles: new Map([
        ['lc-1', '两数之和'],
        ['oa-amazon-1', '最少修复次数'],
      ]),
      fresh: new Set([3]),
      onProblem() {},
      onUser() {},
      now: 1_000_000 + 125_000,
    }),
  );
  assert.match(html, /Running<span class="js-progress">12\/28<\/span>/);
  assert.match(html, /js-abbr">WA<\/span>Wrong Answer<span class="js-progress">3\/28/);
  assert.match(html, /js-abbr">AC<\/span>Accepted<\/span>/);
  assert.match(html, /class="is-mine is-new"/);
  assert.match(html, /rd-badge is-brand">You</);
  assert.match(html, /rd-badge is-brand">Amazon</);
  assert.match(html, /rd-badge">Problems</);
  assert.match(html, />两数之和<\/button>/);
  assert.match(html, /<span class="js-problem-title">gone-problem<\/span>/);
  assert.match(html, /42 ms/);
  assert.match(html, /9\.0 MB/);
  assert.match(html, /2\.0 KB/);
  assert.match(html, /2 min ago/);
});

test('a poll replaces the newest page and keeps older pages', () => {
  const loaded = [item(5), item(4), item(3), item(2), item(1)];
  const page = [item(7), item(6), item(5, { status: 'wrong_answer' })];
  const merged = mergeFeed(loaded, page);
  assert.deepEqual(merged.map((i) => i.seq), [7, 6, 5, 4, 3, 2, 1]);
  assert.equal(merged[2].status, 'wrong_answer');
  assert.equal(mergeFeed(loaded, []), loaded);
  // More than a page arrived while hidden: restart instead of showing a gap.
  assert.equal(mergeFeed(loaded, [item(50), item(49)]), null);
});

test('relative times', () => {
  const now = Date.UTC(2026, 9, 10, 12);
  assert.equal(relativeTime(now - 3_000, now), 'just now');
  assert.equal(relativeTime(now - 45_000, now), '45 sec ago');
  assert.equal(relativeTime(now - 7_200_000, now), '2 h ago');
  assert.match(relativeTime(now - 3 * 86_400_000, now), /^\d{2}-\d{2} \d{2}:\d{2}$/);
  assert.equal(relativeTime(now - 3_000, now, 'zh'), '刚刚');
  assert.equal(relativeTime(now - 45_000, now, 'zh'), '45 秒前');
  assert.equal(relativeTime(now - 180_000, now, 'zh'), '3 分钟前');
  assert.equal(relativeTime(now - 7_200_000, now, 'zh'), '2 小时前');
  assert.match(relativeTime(now - 3 * 86_400_000, now, 'zh'), /^\d{2}-\d{2} \d{2}:\d{2}$/);
});
