// Practicing without the AI: answer steps with their own clocks, "Outline by steps", rapid-fire
// questions that move on at 90 seconds, a coding question's follow-ups one part at a time, and the
// key points ticked off against the answer, counted on the summary.
import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

register(
  `data:text/javascript,${encodeURIComponent(
    "export async function resolve(s,c,n){if(s==='next/link')return {url:'data:text/javascript,export default function Link(){return null}',shortCircuit:true};return n(s,c);}" +
      "export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'export default {}',shortCircuit:true};return n(u,c);}",
  )}`,
  import.meta.url,
);

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/?view=mock-interview' });
for (const name of ['window', 'document', 'HTMLElement', 'HTMLTextAreaElement', 'Element', 'Node', 'Event', 'localStorage', 'navigator', 'location', 'history'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
dom.window.Element.prototype.scrollIntoView = () => {};
// The clocks read Date.now: tests move it forward instead of waiting.
const realNow = Date.now;
let skew = 0;
Date.now = () => realNow() + skew;
const { createRoot } = await import('react-dom/client');
const { MockInterview } = await import('../components/mock-interview.tsx');

const FUNDAMENTALS = 'Software Engineering Fundamentals';
const item = (id, title, category, extra = {}) => ({
  id, type: 'interview_question', slug: id, title, company: null, role: null, round: null, category, difficulty: null, problem: null,
  math: false, principles: [], question: `${title}?`, hints: '', followUps: '', rubric: '', solution: '', ...extra,
});
const rapid = (k, it) => ({ kind: 'design', category: FUNDAMENTALS, minutes: 1.5, rapid: 2, name: [`快问快答 ${k}/2`, `Rapid-fire ${k}/2`], similar: false, pool: 40, item: it });
const set = {
  seed: 'r4p1d000',
  rerolls: [],
  template: { id: 'screen-rapid', name: ['快问快答 + 多段编程电面', 'Rapid-fire + multi-part coding screen'] },
  slots: [
    rapid(1, item('iq-tcp', 'TCP vs UDP', FUNDAMENTALS, { hints: 'Think of streams.', rubric: '- Reliable delivery\n- Ordering\n- Connection setup cost' })),
    rapid(2, item('iq-dns', 'How does DNS resolve a name', FUNDAMENTALS)),
    { kind: 'analytics', minutes: 15, similar: false, pool: 40, item: item('iq-ab', 'Design an A/B test for a new checkout button', 'Analytics & Experimentation') },
    {
      kind: 'coding', minutes: 35, parts: true, name: ['多段编程题', 'Multi-part coding'], similar: false, pool: 40,
      item: {
        ...item('cq-sum', 'Two sum', 'Coding & Algorithms'), type: 'coding_question',
        parts: [{ q: ['如果数组已经排好序？', 'What if the array is sorted?'] }, { q: ['三个数呢？', 'And three numbers?'] }],
      },
    },
  ],
};
globalThis.fetch = async (url) => {
  const path = String(url);
  if (path === '/api/metrics') return new Response(null, { status: 204 });
  if (path.startsWith('/api/content/mock?')) return Response.json(set);
  return Response.json({ error: `unexpected ${path}` }, { status: 500 });
};
const settle = () => new Promise((r) => setTimeout(r, 0));
const $ = (selector) => document.querySelector(selector);
const text = (selector) => $(selector)?.textContent ?? '';
const button = (label) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(label));
const act2 = (fn) =>
  act(async () => {
    fn();
    await settle();
    await settle();
  });
const click = (el) => act2(() => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
// Moves the clock on, then lets the half-second ticker see it.
const later = (seconds) =>
  act(async () => {
    skew += seconds * 1000;
    await new Promise((r) => setTimeout(r, 650));
  });
const mount = async (params) => {
  const root = createRoot(document.getElementById('root'));
  await act2(() => root.render(createElement(MockInterview, { params: { view: 'mock-interview', template: 'screen-rapid', set: set.seed, ...params }, navigate() {}, problemIds: [], userId: null })));
  return root;
};
const states = () => [...document.querySelectorAll('.mi-guide-steps li')].map((li) => li.dataset.state);
const rail = (n) => click(document.querySelectorAll('.mi-rail button')[n - 1]);
const saved = (mode = 'solo') => JSON.parse(localStorage.getItem('cswork:mock-interview:runs'))[`${mode}:template=screen-rapid&set=${set.seed}`];

beforeEach(() => {
  localStorage.clear();
  skew = 0;
});

test('answer steps advance on next and skip, each on its own clock; outline by steps; follow-ups come one part at a time', async () => {
  const root = await mount({});
  try {
    await click(button('Start the clock'));
    // The rapid-fire questions have no steps.
    assert.equal($('.mi-guide'), null);
    await rail(3);
    assert.deepEqual(states(), ['now', 'todo', 'todo', 'todo', 'todo', 'todo']);
    assert.match(text('#mi-guide-title'), /^Step 1: Hypothesis00:00 \/ 2′/);
    assert.match(text('.mi-guide-now'), /which user behavior it should move/);
    await click(button('Next step'));
    assert.deepEqual(states(), ['done', 'now', 'todo', 'todo', 'todo', 'todo']);
    assert.match(text('#mi-guide-title'), /^Step 2: Metrics and guardrails/);
    await click(button('Skip'));
    assert.deepEqual(states(), ['done', 'done', 'now', 'todo', 'todo', 'todo']);
    assert.deepEqual(saved().guide[2].done, [{ step: 'hypothesis' }, { step: 'metrics', skipped: true }]);
    // The step's own clock runs from when it began, and turns over its two minutes.
    assert.equal($('.mi-guide-clock').dataset.over, undefined);
    await later(150);
    assert.equal($('.mi-guide-clock').dataset.over, 'true');
    assert.match(text('.mi-guide-clock'), /^02:3\d \/ 2′$/);

    // An empty answer can start from the steps as headings.
    await click(button('Outline by steps'));
    assert.equal(
      $('.ip-try-input').value,
      '## 1. Hypothesis (2′)\n\n## 2. Metrics and guardrails (3′)\n\n## 3. Randomization unit (2′)\n\n## 4. Sample size (3′)\n\n## 5. Duration (2′)\n\n## 6. Risks (3′)\n',
    );
    assert.equal(button('Outline by steps'), undefined);

    // The multi-part coding question shows its follow-ups only as their part comes up.
    await rail(4);
    assert.deepEqual([...document.querySelectorAll('.mi-guide-steps li')].map((li) => li.textContent), ['1Part 1', '2Part 2', '3Part 3']);
    assert.match(text('#mi-guide-title'), /^Step 1: Part 100:00 \/ 17′/);
    assert.doesNotMatch(document.body.textContent, /What if the array is sorted|And three numbers/);
    await click(button('Next step'));
    assert.match(text('.mi-guide-now'), /Step 2: Part 2.*\/ 9′What if the array is sorted\?/);
    assert.doesNotMatch(document.body.textContent, /And three numbers/);
    await click(button('Next step'));
    await click(button('Next step'));
    assert.match(text('#mi-guide-title'), /All 3 steps done/);
  } finally {
    await act(async () => root.unmount());
  }
});

test('the candidate view gets the steps and the outline button on its notes', async () => {
  const root = await mount({ as: 'candidate' });
  try {
    await rail(3);
    assert.deepEqual(states(), ['now', 'todo', 'todo', 'todo', 'todo', 'todo']);
    await click(button('Outline by steps'));
    assert.match($('.mi-notes textarea').value, /^## 1\. Hypothesis \(2′\)\n\n## 2\. Metrics and guardrails \(3′\)/);
    assert.deepEqual(saved('candidate').notes[2].split('\n')[0], '## 1. Hypothesis (2′)');
  } finally {
    await act(async () => root.unmount());
  }
});

test('a rapid-fire question moves on at 90 seconds while the clock runs, without hints or a time-up note', async () => {
  const root = await mount({});
  try {
    await click(button('Start the clock'));
    assert.match(text('.mi-stage-kicker'), /^Question 1 of 4 · 1\.5 min suggested/);
    assert.equal(button('Show a hint'), undefined);
    await later(60);
    assert.match(text('.mi-stage-kicker'), /^Question 1 of 4/);
    await later(31);
    assert.match(text('.mi-stage-kicker'), /^Question 2 of 4/);
    assert.equal($('.mi-stage-up'), null);
    // Paused, it waits.
    await click($('.mi-clock-actions button'));
    await later(120);
    assert.match(text('.mi-stage-kicker'), /^Question 2 of 4/);
    await click($('.mi-clock-actions button'));
    await later(89);
    assert.match(text('.mi-stage-kicker'), /^Question 2 of 4/);
    await later(2);
    assert.match(text('.mi-stage-kicker'), /^Question 3 of 4/);
    // Other questions keep their own pace: over time they stay, with the time-up note.
    await later(1000);
    assert.match(text('.mi-stage-kicker'), /^Question 3 of 4/);
    assert.match(text('.mi-stage-up'), /Time's up/);
    const elapsed = saved().elapsed;
    assert.ok(elapsed[0] >= 90 && elapsed[0] < 95, String(elapsed[0]));
  } finally {
    await act(async () => root.unmount());
  }
});

test('key points ticked after the answer opens show on the summary; the interviewer ticks them from the start', async () => {
  let root = await mount({});
  try {
    await click(button('Start the clock'));
    await rail(4);
    await click(button('Finish'));
    // Reviewed after the interview, a rapid-fire question is untimed and has its hint back.
    await click(button('Review questions & answers'));
    assert.match(text('.mi-stage-kicker'), /^Question 1 of 4/);
    assert.ok(button('Show a hint'));
    assert.equal($('.recall-points'), null);
    await click(button('Show the answer'));
    await click(button('Show it anyway'));
    assert.equal(text('.mi-reveal .recall-points legend'), 'Key points you covered (0 of 3)');
    const boxes = document.querySelectorAll('.mi-reveal .recall-points input');
    await click(boxes[2]);
    await click(boxes[0]);
    assert.equal(text('.mi-reveal .recall-points legend'), 'Key points you covered (2 of 3)');
    assert.deepEqual(saved().checked, { 0: [0, 2] });
    await rail(4);
    await click(button('Finish'));
    const head = [...document.querySelectorAll('.mi-table th')].map((th) => th.textContent);
    assert.equal(head.at(-1), 'Key points');
    const cells = [...document.querySelectorAll('.mi-table tbody tr')].map((tr) => tr.lastElementChild.textContent);
    // No rubric on the A/B question: its six steps are the points.
    assert.deepEqual(cells, ['2/3', '—', '0/6', '0/3']);
  } finally {
    await act(async () => root.unmount());
  }
  root = await mount({ as: 'interviewer' });
  try {
    const steps = [...document.querySelectorAll('.mi-sheet-steps')];
    assert.equal(steps.length, 2);
    assert.match(steps[0].textContent, /Hypothesis · 2′/);
    assert.match(steps[1].textContent, /Part 1 · 17′ .*Part 2 · 9′ What if the array is sorted\?Part 3 · 9′ And three numbers\?/);
    const legends = [...document.querySelectorAll('.mi-sheet-slot .recall-points legend')].map((l) => l.textContent);
    assert.deepEqual(legends, [
      'Key points the candidate covered (0 of 3)',
      'Key points the candidate covered (0 of 6)',
      'Key points the candidate covered (0 of 3)',
    ]);
    await click(document.querySelector('.mi-sheet-slot .recall-points input'));
    assert.deepEqual(saved('interviewer').checked, { 0: [0] });
  } finally {
    await act(async () => root.unmount());
  }
});
