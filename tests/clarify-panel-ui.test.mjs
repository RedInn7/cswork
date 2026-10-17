import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

register(
  `data:text/javascript,${encodeURIComponent(`export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}`)}`,
  import.meta.url,
);

const dom = new JSDOM('<div id="root"></div>', { url: 'https://cswork.test/' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'navigator'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { ClarifyPanel } = await import('../components/clarify-panel.tsx');
const { EditorialSteps, EditorialFollowUps, timeOptions, stopOptions } = await import('../components/ling-editorial-steps.tsx');

const root = createRoot(document.getElementById('root'));
const render = (element) => act(async () => root.render(element));
const $ = (selector) => document.querySelector(selector);
const buttons = (text) => [...document.querySelectorAll('button')].filter((b) => b.textContent.includes(text));
const click = (el) => act(async () => el.click());
const text = () => document.getElementById('root').textContent;

test('the checklist: tick, compare, then add one case or all of them within the cap', async () => {
  const added = [];
  let room = 5;
  const onAdd = (inputs) => {
    const fit = inputs.slice(0, room);
    added.push(...fit);
    room -= fit.length;
    return inputs.length - fit.length;
  };
  const props = {
    problemId: 'lc-1',
    params: [
      { name: 'nums', type: 'integer[]' },
      { name: 'target', type: 'integer' },
    ],
    constraints: { nums: { len: [2, 10000], val: [-1e9, 1e9] }, target: { val: [-1e9, 1e9] } },
    edges: [
      { zh: '两个相同的值', en: 'Two equal values', input: '[3,3]\n6' },
      { zh: '负数', en: 'Negatives', input: '[-1,-2]\n-3' },
    ],
    english: true,
    onAdd,
  };
  await render(createElement(ClarifyPanel, props));
  // Folded until asked for.
  assert.equal($('#clarify-body').hidden, true);
  await click(buttons('Before you code')[0]);
  assert.equal($('#clarify-body').hidden, false);
  const questions = [...document.querySelectorAll('.cs-clarify-ask label')].map((l) => l.textContent);
  assert.ok(questions.some((q) => q.includes('overflow')));
  // Nothing of the reference shows before the learner compares.
  assert.equal($('.cs-clarify-reference'), null);
  const overflow = [...document.querySelectorAll('.cs-clarify-ask input')][2];
  await click(overflow);
  await click(buttons('Compare with the checklist')[0]);
  assert.match(text(), /10\^4 × 10\^9 = 10\^13/);
  assert.match(text(), /You asked:/);
  assert.match(text(), /Two equal values/);
  // The accessible name starts with the visible text (WCAG 2.5.3).
  assert.equal(buttons('Add case')[0].getAttribute('aria-label'), 'Add case: Two equal values');
  await click(buttons('Add case')[0]);
  assert.deepEqual(added, ['[3,3]\n6']);
  assert.match($('[role=status].cs-clarify-hint').textContent, /Added/);
  // lc-1 is not whitelisted for random inputs, so only the two edges are cases.
  const all = buttons('Add all as custom cases (2)')[0];
  room = 1;
  await click(all);
  assert.deepEqual(added, ['[3,3]\n6', '[3,3]\n6']);
  assert.match($('[role=status].cs-clarify-hint').textContent, /1 didn't fit/);
  // ACM mode: no add buttons, a pointer to LeetCode mode instead.
  await render(createElement(ClarifyPanel, { ...props, onAdd: undefined, english: false }));
  assert.equal(buttons('加为用例').length, 0);
  assert.match(text(), /切到 LeetCode 模式/);
});

const approach = (name, time) => ({ nameZh: name, nameEn: name, ideaZh: `${name}的思路`, ideaEn: `${name} idea`, time, space: 'O(1)', python: '', cpp: '', java: '', go: '' });

test('step options: four distinct complexities in growth order, the stop among its neighbours', () => {
  assert.deepEqual(timeOptions([approach('a', 'O(n²)'), approach('b', 'O(n)')]), ['O(1)', 'O(log n)', 'O(n)', 'O(n²)']);
  assert.deepEqual(timeOptions([approach('a', 'O(m·n)'), approach('b', 'O(mn)')]).length, 4);
  assert.deepEqual(stopOptions('array-foundations'), ['array-foundations', 'hash-counting', 'string-processing', 'two-pointers-windows']);
  assert.deepEqual(stopOptions('hash-counting'), ['array-foundations', 'hash-counting', 'string-processing', 'two-pointers-windows']);
  assert.deepEqual(stopOptions(null), []);
});

test('step by step: answer or skip each checkpoint, then the code', async () => {
  let done = 0;
  await render(
    createElement(EditorialSteps, {
      approaches: [approach('Brute', 'O(n^2)'), approach('Hash', 'O(n)')],
      stop: 'hash-counting',
      english: true,
      onDone: () => done++,
    }),
  );
  assert.match(text(), /Step 1 of 4Start with the first approach/);
  assert.match(text(), /Brute idea/);
  await click(buttons('O(n)')[0]);
  assert.match($('.cs-ling-check [role=status]').textContent, /Not quite: it is O\(n\^2\)/);
  await click(buttons('Next')[0]);
  assert.match(text(), /Step 2 of 4/);
  await click(buttons('Hashing')[0]);
  assert.equal($('.cs-ling-check [role=status]').textContent, 'Right.');
  await click(buttons('Next')[0]);
  assert.match(text(), /Hash idea/);
  assert.equal(document.activeElement, $('.cs-ling-steps > h3'));
  await click(buttons('Show the code')[0]);
  assert.equal(done, 1);
  // An idea that already states its time (n² is n^2) asks nothing about it.
  const told = { ...approach('DP', 'O(m·n)'), ideaEn: 'Fill the table in O(m n) time.' };
  await render(createElement(EditorialSteps, { key: 'told', approaches: [told, approach('Rolling', 'O(m·n)')], english: true, onDone() {} }));
  assert.match(text(), /Step 1 of 3/);
  assert.equal($('.cs-ling-check'), null);
});

test('follow-ups: the follow-up mode first, answers folded, a practice link and the takeaway', async () => {
  const switched = [];
  const extras = {
    takeawayZh: '要点',
    takeawayEn: 'Look up before inserting.',
    followUps: [{ qZh: '有序呢？', qEn: 'Sorted?', aZh: '双指针', aEn: 'Two pointers.', problem: 'lc-167' }],
  };
  // lc-9 has a follow-up rule (no string conversion).
  const props = { problemId: 'lc-9', extras, language: 'python', english: true, onFollowUp: (on) => switched.push(on) };
  await render(createElement(EditorialFollowUps, { ...props, followUpOn: false }));
  assert.match(text(), /Now: Without converting the integer to a string/);
  const box = () => $('.cs-ling-followups input[type=checkbox]');
  assert.equal(box().checked, false);
  await click(box());
  assert.deepEqual(switched, [true]);
  // The workspace's own switch: turned on from the toolbar, it shows on here, and turns off.
  await render(createElement(EditorialFollowUps, { ...props, followUpOn: true }));
  assert.equal(box().checked, true);
  await click(box());
  assert.deepEqual(switched, [true, false]);
  assert.equal($('.cs-ling-followups details').open, false);
  assert.equal($('.cs-ling-followups a').getAttribute('href'), '/?view=problem&problem=lc-167');
  assert.match(text(), /TakeawayLook up before inserting/);
  // ACM mode: the rule, no switch, and where to turn it on.
  await render(createElement(EditorialFollowUps, { ...props, onFollowUp: undefined }));
  assert.equal(box(), null);
  assert.match(text(), /Switch to LeetCode mode to turn it on/);
  // Nothing to show: no section at all.
  await render(createElement(EditorialFollowUps, { problemId: 'lc-1', extras: {}, language: 'python', english: true }));
  assert.equal($('.cs-ling-followups'), null);
});
