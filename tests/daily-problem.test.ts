import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  beijingDate,
  dailyPick,
  dailySolved,
  dailyStreak,
} from '../lib/daily-problem';
import { dailySource } from '../lib/server/daily-problem';

const DAY = 86400000;
// 2026-10-14 01:00 in Beijing is still 2026-10-13 in UTC.
const NOW = Date.UTC(2026, 9, 13, 17);

void test('the day follows Beijing time, not UTC', () => {
  assert.equal(beijingDate(NOW), '2026-10-14');
  assert.equal(beijingDate(Date.UTC(2026, 9, 13, 15, 59)), '2026-10-13');
});

void test('odd dates draw Line 500, even dates the hot OAs, the same draw for everyone', () => {
  const line = Array.from({ length: 40 }, (_, k) => `lc-${k + 1}`);
  const oa = Array.from({ length: 40 }, (_, k) => `oa-amazon-${k + 1}`);
  assert.match(dailyPick('2026-10-13', line, oa)!, /^lc-/);
  assert.match(dailyPick('2026-10-14', line, oa)!, /^oa-/);
  assert.equal(dailyPick('2026-10-13', line, oa), dailyPick('2026-10-13', [...line].reverse(), oa));
  // An empty pool falls back to the other one; nothing at all is null.
  assert.match(dailyPick('2026-10-14', line, [])!, /^lc-/);
  assert.equal(dailyPick('2026-10-14', [], []), null);
  // Different days spread over the pool.
  const days = Array.from({ length: 15 }, (_, k) => `2026-11-${String(2 * k + 1).padStart(2, '0')}`);
  assert.ok(new Set(days.map((d) => dailyPick(d, line, oa))).size > 8);
});

void test('publishing a problem only moves the days it now wins', () => {
  const line = Array.from({ length: 60 }, (_, k) => `lc-${k + 1}`);
  const days = Array.from({ length: 60 }, (_, k) => beijingDate(NOW + 2 * k * DAY + DAY));
  const before = days.map((d) => dailyPick(d, line, []));
  const after = days.map((d) => dailyPick(d, [...line, 'lc-999'], []));
  assert.ok(after.every((id, k) => id === before[k] || id === 'lc-999'));
});

void test('the daily streak counts Beijing days and survives until today ends', () => {
  const done = [NOW - DAY, NOW - 2 * DAY, NOW - 4 * DAY];
  assert.equal(dailyStreak(done, NOW), 2);
  assert.equal(dailyStreak([...done, NOW], NOW), 3);
  assert.equal(dailyStreak([NOW - 3 * DAY], NOW), 0);
  assert.equal(dailySolved({ date: '2026-10-14', done: [NOW] }), true);
  assert.equal(dailySolved({ date: '2026-10-14', done: [NOW - DAY] }), false);
});

void test('the server source takes judgeable pools, names the company and finds completions', () => {
  const summaries = [
    { id: 'lc-35', title: '搜索插入位置', titleEn: 'Search Insert Position', difficulty: '简单', tags: [] },
    { id: 'lc-99999', title: 'Off the line', difficulty: '简单', tags: [] },
    { id: 'oa-amazon-1', title: 'Amazon OA', difficulty: '中等', tags: [] },
    { id: 'oa-nobody-1', title: 'Not hot', difficulty: '中等', tags: [] },
  ];
  const source = dailySource(summaries, [{ name: 'Amazon', aliases: ['amazon'] }]);
  const odd = Date.UTC(2026, 9, 13, 4); // 2026-10-13 in Beijing
  const even = odd + DAY;
  const lc = source.daily([{ problem_id: 'lc-35', created_at: odd }], odd)!;
  assert.equal(lc.id, 'lc-35');
  assert.equal(lc.kind, 'lc');
  assert.equal(lc.stop, 'binary-search');
  assert.equal(lc.titleEn, 'Search Insert Position');
  assert.deepEqual(lc.done, [odd]);
  const oa = source.daily(
    [
      { problem_id: 'oa-amazon-1', created_at: even },
      // Yesterday's problem solved today is not today's completion.
      { problem_id: 'lc-35', created_at: even },
      { problem_id: 'lc-35', created_at: odd },
    ],
    even,
  )!;
  assert.equal(oa.id, 'oa-amazon-1');
  assert.deepEqual(oa.company, { slug: 'amazon', name: 'Amazon' });
  assert.deepEqual(oa.done, [even, odd]);
  assert.equal(dailyStreak(oa.done, even), 2);
});
