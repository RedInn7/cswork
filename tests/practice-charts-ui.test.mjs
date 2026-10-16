import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EffortChart } from '../app/u/practice-charts.tsx';

// The daily effort chart's per-day numbers reach screen readers (role=img hides its <title>s),
// and stacked segments keep a gap so they don't rely on hue alone.
const effort = { start: Date.UTC(2026, 9, 1), days: [[1, 0, 2], [0, 0, 0], [0, 3, 0]] };

test('effort chart lists each active day for screen readers, matching the tooltips', () => {
  const html = renderToStaticMarkup(createElement(EffortChart, { effort, zh: false }));
  const list = html.match(/<ul class="sr-only" aria-label="Daily breakdown">(.*?)<\/ul>/)?.[1];
  assert.ok(list, html);
  const items = [...list.matchAll(/<li>(.*?)<\/li>/g)].map((m) => m[1]);
  assert.deepEqual(items, ['Oct 1, 2026: Easy 1, Medium 0, Hard 2', 'Oct 3, 2026: Easy 0, Medium 3, Hard 0']);
  assert.deepEqual([...html.matchAll(/<title>(.*?)<\/title>/g)].map((m) => m[1]), items);

  const zh = renderToStaticMarkup(createElement(EffortChart, { effort, zh: true }));
  assert.match(zh, /aria-label="每日明细"><li>2026年10月1日：简单 1，中等 0，困难 2<\/li>/);
});

test('stacked segments leave a gap and never get a negative height', () => {
  const html = renderToStaticMarkup(createElement(EffortChart, { effort: { start: effort.start, days: [[1, 1, 1], [400, 0, 0]] }, zh: false }));
  const rects = [...html.matchAll(/<rect[^>]* y="([\d.]+)" height="([\d.]+)"/g)].map((m) => [+m[1], +m[2]]);
  assert.equal(rects.length, 4);
  for (const [, h] of rects) assert.ok(h > 0);
  const [easy, medium] = rects;
  assert.ok(medium[0] + medium[1] < easy[0], 'medium sits above easy with a gap');
});
