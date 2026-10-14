import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { register } from 'node:module';
register(
  `data:text/javascript,${encodeURIComponent("export async function load(url, context, next) { if (url.endsWith('.css')) return { format: 'module', source: 'export default {}', shortCircuit: true }; return next(url, context); }")}`,
  import.meta.url,
);

const question = (n, answer, choices, extra = {}) => ({
  id: `lc-${n}`,
  number: n,
  titleZh: `题 ${n}`,
  titleEn: `Problem ${n}`,
  reason: '理由',
  reasonEn: `Reason ${n}`,
  answer,
  choices,
  ...extra,
});
const round = [
  question(1, 'hash-counting', ['array-foundations', 'hash-counting', 'string-processing', 'two-pointers-windows'], {
    excerptEn: 'Given an array `nums`.',
    excerptZh: '给你一个数组。',
  }),
  question(2, 'dp-stock', ['dp-stock', 'dp-state-machine', 'dp-scheduling', 'dp-palindrome']),
];

test('the speedrun answers with 1-4, moves on with Enter, and records the best score', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.org/?view=speedrun' });
  for (const name of ['window', 'document', 'location', 'HTMLElement', 'Element', 'Node', 'Event', 'KeyboardEvent', 'MouseEvent', 'localStorage', 'sessionStorage'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const beacons = [];
  let rounds = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('/api/metrics')) {
      beacons.push(JSON.parse(init.body));
      return new Response('{}');
    }
    assert.equal(url, '/api/oj/speedrun');
    rounds++;
    return Response.json({ questions: round });
  };
  localStorage.setItem('cswork:speedrun:best', '1');
  const { createRoot } = await import('react-dom/client');
  const { Speedrun } = await import('../components/speedrun.tsx');
  const root = createRoot(document.getElementById('root'));
  const navigated = [];
  const navigate = (view, extra) => navigated.push([view, extra]);
  await act(async () => root.render(createElement(Speedrun, { boot: { person: null }, navigate })));
  const text = () => document.body.textContent;
  const key = (k) => act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })));

  assert.equal(rounds, 1);
  assert.ok(text().includes('Problem 1'));
  assert.ok(text().includes('Given an array'), 'members see the excerpt the server sent');
  assert.equal(document.querySelectorAll('.sr-choice').length, 4);
  assert.equal(document.querySelector('.sr-guest') === null, true, 'no sign-in prompt when an excerpt is present');

  // Wrong answer with key 1: the right stop is shown, the reason appears, Next takes focus.
  await key('1');
  assert.ok(text().includes("Not quite: it's stop 02, Hashing"));
  assert.ok(text().includes('Reason 1'));
  assert.equal(document.querySelector('.sr-choice[data-state="wrong"]')?.textContent.includes('In-place Arrays'), true);
  assert.equal(document.querySelectorAll('.sr-choice:disabled').length, 4);
  assert.equal(document.activeElement?.classList.contains('sr-cta'), true);
  // A second key does not change the answer.
  await key('2');
  assert.equal(document.querySelector('.sr-choice[data-state="wrong"]') !== null, true);

  // Solve it goes to the problem.
  const solve = [...document.querySelectorAll('a')].find((a) => a.textContent === 'Solve it');
  assert.equal(solve?.getAttribute('href'), '/?view=problem&problem=lc-1');
  await act(async () => solve.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })));
  assert.deepEqual(navigated, [['problem', { problem: 'lc-1' }]]);

  // Enter from the page (not a button) moves on; guests without an excerpt see the sign-in prompt.
  document.body.focus();
  await act(async () => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  assert.ok(text().includes('Problem 2'));
  assert.equal(document.querySelector('.sr-guest') !== null, true);
  assert.equal(document.activeElement?.id, 'sr-heading', 'the new question takes focus');
  await key('1');
  assert.ok(text().includes('Correct'));
  assert.ok(text().includes('See results'));
  await key('Enter');

  // Results: 1 of 2 ties the stored best of 1, so no new record.
  assert.equal(document.querySelector('.sr-score')?.textContent.includes('1/ 2'), true);
  assert.equal(text().includes('New best'), false);
  assert.equal(localStorage.getItem('cswork:speedrun:best'), '1');
  assert.ok(text().includes('Linear Structures'));
  assert.ok(text().includes('Dynamic Programming'));
  assert.equal(document.querySelectorAll('.sr-review li').length, 2);
  assert.equal(document.querySelectorAll('.sr-review li[data-right]').length, 1);
  const finish = beacons.flatMap((b) => b.events).filter((e) => e.name === 'speedrun_finish');
  assert.deepEqual(finish.map((e) => e.params), [{ score: 1 }]);

  // Another round fetches again and starts at question 1.
  const again = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Another round'));
  await act(async () => again.click());
  assert.equal(rounds, 2);
  assert.ok(text().includes('Problem 1'));
  await act(async () => root.unmount());
});

test('a blocked localStorage never breaks the round', async () => {
  const { Speedrun } = await import('../components/speedrun.tsx');
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.org/?view=speedrun' });
  for (const name of ['window', 'document', 'location', 'HTMLElement', 'Element', 'Node', 'Event', 'KeyboardEvent', 'MouseEvent'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('blocked');
    },
  });
  globalThis.fetch = async (url) =>
    String(url).startsWith('/api/metrics') ? new Response('{}') : Response.json({ questions: round.slice(1) });
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(Speedrun, { boot: { person: null }, navigate() {} })));
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' })));
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })));
  assert.equal(document.querySelector('.sr-score')?.textContent.includes('1/ 1'), true);
  await act(async () => root.unmount());
});
