import assert from 'node:assert/strict';
import { test } from 'node:test';
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
const { createRoot } = await import('react-dom/client');
const { MockInterview } = await import('../components/mock-interview.tsx');
const { MAX_FEEDBACK, decodeFeedback, encodeFeedback } = await import('../lib/mock-interview-feedback.ts');

const set = {
  seed: 'k3x9q2ab',
  rerolls: [],
  template: { id: 'custom', name: ['自定义', 'Custom'] },
  slots: [
    {
      kind: 'coding', minutes: 25, similar: false, pool: 80,
      item: {
        id: 'cq-sum', type: 'coding_question', slug: 'sum', title: 'Sum two', company: null, role: null, round: null,
        difficulty: null, problem: null, math: false, principles: [], question: 'Add two numbers.',
        hints: '', followUps: '', rubric: '', solution: '',
      },
    },
  ],
};
const params = { view: 'mock-interview', template: 'custom', mix: 'coding.1', set: 'k3x9q2ab', as: 'ai' };
let calls = [];
let answer;
globalThis.fetch = async (url, init = {}) => {
  const path = String(url);
  // Analytics beacons are not under test.
  if (path === '/api/metrics') return new Response(null, { status: 204 });
  if (path.startsWith('/api/content/mock?')) {
    calls.push({ path });
    return Response.json(set);
  }
  calls.push({ path, body: JSON.parse(init.body) });
  return answer(path);
};

const root = createRoot(document.getElementById('root'));
const settle = () => new Promise((r) => setTimeout(r, 0));
const render = (props = {}) =>
  act(async () => {
    root.render(createElement(MockInterview, { params, navigate: () => {}, problemIds: [], userId: 'u1', ai: true, ...props }));
    await settle();
  });
const $ = (selector) => document.querySelector(selector);
const type = (el, value) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
const submit = () =>
  act(async () => {
    $('.mi-ai-compose').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    await settle();
  });
const click = (el) =>
  act(async () => {
    el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await settle();
    await settle();
  });

test('an AI interview: questions only, the code rides along, failures cost no turn, the report lands in the history', async () => {
  // A person's feedback on this set from an earlier pairing: the AI's report must not replace it.
  const human = encodeFeedback({ seed: 'k3x9q2ab', rerolls: [], rubric: { communication: 2 }, verdict: 'no', strengths: 'HUMAN-NOTE', improvements: '', questions: [] }).value;
  const query = { template: 'custom', mix: 'coding.1', set: 'k3x9q2ab' };
  localStorage.setItem(
    'cswork:mock-interview:history',
    JSON.stringify([{ query, name: ['自定义', 'Custom'], company: null, at: 1, items: [], feedback: human }]),
  );
  await render();
  // The set is fetched without its answers.
  assert.equal(calls[0].path.includes('parts=question'), true);
  assert.equal($('.mi-head-kicker').textContent.includes('AI interviewer'), true);
  const log = () => [...document.querySelectorAll('.mi-ai-log li')];
  assert.equal(log().length, 1);
  assert.equal(log()[0].dataset.role, 'interviewer');
  assert.equal($('.mi-ai-left').textContent, '40 of 40 messages left');
  assert.equal($('.mi-ai-privacy').textContent.includes('Anthropic'), true);
  // No speech in this browser: neither button is offered.
  assert.equal(document.querySelectorAll('.mi-ai-tool').length, 0);

  await type($('.mi-work-main .mi-notes textarea'), 'def f(a, b): return a + b');
  await type($('#mi-ai-input'), 'Can the input be empty?');
  answer = () => Response.json({ text: 'No. What is your approach?', ticket: 'T1' });
  await submit();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].path, '/api/oj/ai/interview');
  const first = calls[1].body;
  assert.equal(first.itemId, 'cq-sum');
  assert.equal(first.seed, 'k3x9q2ab');
  assert.equal(first.code, 'def f(a, b): return a + b');
  assert.deepEqual(first.history, [{ role: 'candidate', text: 'Can the input be empty?' }]);
  assert.equal('ticket' in first, false);
  assert.deepEqual(log().map((li) => li.dataset.role), ['interviewer', 'candidate', 'interviewer']);
  // Each message names its speaker for screen readers.
  assert.equal(log()[2].textContent, 'Interviewer: No. What is your approach?');
  assert.equal($('.mi-ai-left').textContent, '39 of 40 messages left');
  assert.equal($('#mi-ai-input').value, '');

  // Unanswered: the message goes back to the box and the count stays.
  answer = () => Response.json({ error: 'AI 面试官暂时不可用，请稍后再试' }, { status: 503 });
  await type($('#mi-ai-input'), 'I add them.');
  await submit();
  assert.equal(calls[2].body.ticket, 'T1');
  assert.equal(calls[2].body.history.length, 3);
  assert.equal($('.mi-ai-error').textContent, 'The AI interviewer is unavailable right now. Please try again later');
  assert.equal($('#mi-ai-input').value, 'I add them.');
  assert.equal(log().length, 3);
  assert.equal($('.mi-ai-left').textContent, '39 of 40 messages left');

  // A long report: whole on the page, an excerpt in the link.
  const strengths = `Asked about empty input. ${'Clear reasoning throughout. '.repeat(40)}STRENGTHS-END`;
  const improvements = `State the complexity. ${'Test the edges first. '.repeat(40)}IMPROVE-END`;
  answer = () =>
    Response.json({
      report: {
        rubric: { communication: 3, problem: 3, coding: 2, testing: null, complexity: null },
        verdict: 'yes',
        strengths,
        improvements,
        questions: [{ rating: 3, note: 'Clean.' }],
      },
    });
  const finish = [...document.querySelectorAll('.mi-steps .mi-cta')].at(-1);
  assert.equal(finish.textContent.includes('Finish and get the report'), true);
  await click(finish);
  const report = calls.at(-1);
  assert.equal(report.path, '/api/oj/ai/interview-report');
  assert.equal(report.body.ticket, 'T1');
  assert.equal(report.body.questions.length, 1);
  assert.equal(report.body.questions[0].history.length, 2);
  // The summary shows the AI's report in the feedback view, saved with this set.
  assert.equal($('#mi-fb-kicker').textContent, 'AI interviewer report');
  assert.equal($('.mi-fb-private').textContent.includes('may be wrong'), true);
  assert.equal(document.body.textContent.includes('Saved to my sessions'), true);
  assert.equal(document.body.textContent.includes('Copy the report link'), true);
  assert.equal($('.mi-fb-notes').textContent.includes('STRENGTHS-END'), true);
  assert.equal($('.mi-fb-notes').textContent.includes('IMPROVE-END'), true);
  assert.equal(document.body.textContent.includes('HUMAN-NOTE'), false);
  assert.equal(!!$('.mi-report-cut'), true);
  const [saved] = JSON.parse(localStorage.getItem('cswork:mock-interview:history'));
  assert.equal(saved.feedback, human);
  assert.equal(saved.aiFeedback.length > MAX_FEEDBACK, true);
  const feedback = decodeFeedback(saved.aiFeedback, Infinity);
  assert.equal(feedback.ai, true);
  assert.equal(feedback.verdict, 'yes');
  assert.equal(feedback.strengths, strengths);
  assert.equal(saved.items[0].rating, 3);

  // Another account on this browser starts its own interview and never sees this one's conversation.
  await render({ userId: 'u2' });
  assert.equal(log().length, 1);
  assert.equal($('.mi-ai-left').textContent, '40 of 40 messages left');
  await render();
  assert.equal(!!$('.mi-ai-log'), false);
});

test('a message left unanswered by a closed page is dropped from the next request', async () => {
  await act(async () => root.unmount());
  localStorage.clear();
  const key = `ai:u1:${new URLSearchParams({ template: 'custom', mix: 'coding.1', set: 'k3x9q2ab' })}`;
  const chat = [{ role: 'candidate', text: 'Hi' }, { role: 'interviewer', text: 'Hello.' }, { role: 'candidate', text: 'LOST' }];
  localStorage.setItem(
    'cswork:mock-interview:runs',
    JSON.stringify({ [key]: { phase: 'run', index: 0, since: null, elapsed: [], notes: {}, ratings: {}, shown: {}, started: true, chat: { 0: chat }, ticket: 'T9', at: Date.now() } }),
  );
  const again = createRoot(document.getElementById('root'));
  await act(async () => {
    again.render(createElement(MockInterview, { params, navigate: () => {}, problemIds: [], userId: 'u1', ai: true }));
    await settle();
  });
  calls = [];
  answer = () => Response.json({ text: 'Go on.', ticket: 'T9' });
  await type($('#mi-ai-input'), 'Again');
  await submit();
  assert.deepEqual(calls.at(-1).body.history.map((t) => t.text), ['Hi', 'Hello.', 'Again']);
  await act(async () => again.unmount());
});

test('read aloud and dictation appear only where the browser has them; AI off falls back to solo', async () => {
  localStorage.clear();
  const spoken = [];
  globalThis.speechSynthesis = { speak: (u) => spoken.push(u), cancel: () => {} };
  globalThis.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
    }
  };
  let recognizer;
  dom.window.webkitSpeechRecognition = class {
    start() {
      recognizer = this;
    }
    stop() {
      this.onend?.();
    }
  };
  const fresh = createRoot(document.getElementById('root'));
  await act(async () => {
    fresh.render(createElement(MockInterview, { params, navigate: () => {}, problemIds: [], userId: 'u1', ai: true }));
    await settle();
  });
  const [speak] = document.querySelectorAll('.mi-ai-head .mi-ai-tool');
  const dictate = $('.mi-ai-actions .mi-ai-tool');
  assert.equal(speak.getAttribute('aria-pressed'), 'false');
  await click(speak);
  assert.equal(speak.getAttribute('aria-pressed'), 'true');
  await click(dictate);
  assert.equal(dictate.getAttribute('aria-pressed'), 'true');
  await act(async () => recognizer.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: ' I would use a hash map ' }], { isFinal: true })] }));
  assert.equal($('#mi-ai-input').value, 'I would use a hash map');
  answer = () => Response.json({ text: 'Why a hash map?', ticket: 'T2' });
  await submit();
  assert.equal(spoken.length, 1);
  assert.equal(spoken[0].text, 'Why a hash map?');
  assert.equal(spoken[0].lang, 'en-US');
  await click(dictate);
  assert.equal(dictate.getAttribute('aria-pressed'), 'false');
  // Without the AI flag an `as=ai` link is plain solo practice.
  await act(async () => {
    fresh.render(createElement(MockInterview, { params, navigate: () => {}, problemIds: [], userId: 'u1', ai: false }));
    await settle();
  });
  assert.equal($('.mi-ai-side') === null, true);
  assert.equal($('.mi-head-kicker').textContent.includes('Solo practice'), true);
  await act(async () => fresh.unmount());
});
