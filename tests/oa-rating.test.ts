import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RatingBadge } from '../components/rating-badge';
import file from '../lib/content/oa-topics.json';
import { oaRating } from '../lib/server/oa-rating';

const topics = Object.entries(file.problems as Record<string, { d: string; k: string }>);
const find = (k: string, d?: string) => topics.find(([, p]) => p.k === k && (!d || p.d === d))![0];

void test('OA coding problems get the prior of the difficulty they show', () => {
  // A package's explicit 简单/困难 stands; otherwise the estimate does (lib/server/oa-topics.ts).
  assert.equal(oaRating(find('coding', 'medium'), '简单'), 1400);
  assert.equal(oaRating(find('coding', 'medium'), '困难'), 2150);
  assert.equal(oaRating(find('coding', 'medium'), '中等'), 1750);
  assert.equal(oaRating(find('coding', 'hard'), '中等'), 2150);
  assert.equal(oaRating(find('coding', 'easy')), 1400);
  assert.equal(oaRating('oa-nobody-1', '中等'), 1750, 'no estimate: the package says');
  assert.equal(oaRating('oa-nobody-1'), null);
});

void test('LeetCode problems and non-coding OA questions get none', () => {
  assert.equal(oaRating('lc-1', '中等'), null);
  assert.equal(oaRating(find('sql'), '中等'), null);
  assert.equal(oaRating(find('mcq'), '中等'), null);
});

void test('the rating badge marks an estimate as one', () => {
  const badge = (props: { estimated?: boolean; english: boolean }) =>
    renderToStaticMarkup(createElement(RatingBadge, { rating: 1750, ...props }));
  assert.match(badge({ estimated: true, english: false }), /≈1750（估计）<\/span>$/);
  assert.match(badge({ estimated: true, english: true }), /≈1750 \(est\.\)<\/span>$/);
  assert.match(badge({ english: true }), /Contest rating 1750.*>1750<\/span>$/);
});
