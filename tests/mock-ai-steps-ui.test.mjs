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

const set = {
  seed: 'g7q2stp1',
  rerolls: [],
  template: { id: 'onsite', name: ['SWE Onsite 全流程', 'SWE onsite loop'] },
  slots: [
    {
      kind: 'design', minutes: 45, similar: false, pool: 40,
      item: {
        id: 'iq-feed', type: 'interview_question', slug: 'feed', title: 'Design a feed', company: null, role: null, round: null,
        category: 'System Design', difficulty: null, problem: null, math: false, principles: [], question: 'Design a news feed.',
        hints: '', followUps: '', rubric: '', solution: '',
      },
    },
  ],
};
let calls = [];
let answer;
globalThis.fetch = async (url, init = {}) => {
  const path = String(url);
  if (path === '/api/metrics') return new Response(null, { status: 204 });
  if (path.startsWith('/api/content/mock-companies')) return Response.json({ companies: [], total: 0 });
  if (path.startsWith('/api/content/mock?')) return Response.json(set);
  calls.push({ path, body: JSON.parse(init.body) });
  return answer(path);
};
const settle = () => new Promise((r) => setTimeout(r, 0));
const $ = (selector) => document.querySelector(selector);
const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(text));
const act2 = (fn) =>
  act(async () => {
    fn();
    await settle();
    await settle();
  });
const type = (el, value) =>
  act2(() => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
const click = (el) => act2(() => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
const send = async (text, reply) => {
  answer = () => Response.json({ text: reply, ticket: 'T1' });
  await type($('#mi-ai-input'), text);
  await act2(() => $('.mi-ai-compose').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
};

test('a system design question steps through its guide, with feedback per step and on the summary', async () => {
  const root = createRoot(document.getElementById('root'));
  const params = { view: 'mock-interview', template: 'onsite', set: 'g7q2stp1', role: 'swe', as: 'ai' };
  try {
    await act2(() => root.render(createElement(MockInterview, { params, navigate() {}, problemIds: [], userId: 'u1', ai: true })));
    const steps = () => [...document.querySelectorAll('.mi-guide-steps li')].map((li) => li.dataset.state);
    assert.deepEqual(steps(), ['now', 'todo', 'todo', 'todo', 'todo']);
    assert.match($('#mi-guide-title').textContent, /^Step 1: Requirements/);
    // Nothing said in this step yet: nothing to give feedback on.
    assert.equal(button('Finish this step').disabled, true);
    await send('How many users, and reads per write?', 'Ten million, mostly reads.');
    assert.equal(calls[0].body.step, 'requirements');
    answer = () =>
      Response.json({ feedback: { scores: { problem: 3, communication: 4 }, keep: 'You asked about scale first.', fix: 'Name a latency target.' } });
    await click(button('Finish this step'));
    const step = calls[1];
    assert.equal(step.path, '/api/oj/ai/interview-step');
    assert.equal(step.body.ticket, 'T1');
    assert.equal(step.body.step, 'requirements');
    assert.equal(step.body.history.length, 2);
    assert.deepEqual(steps(), ['done', 'now', 'todo', 'todo', 'todo']);
    assert.equal($('.mi-guide-feedback').getAttribute('aria-live'), 'polite');
    assert.match($('.mi-step-card').textContent, /Step 1 feedback · Communication 4\/4 · Problem solving 3\/4/);
    assert.match($('.mi-step-card').textContent, /Fix: Name a latency target\./);
    // The next step's transcript starts after the last one; skipping costs no call.
    await click(button('Skip'));
    assert.equal(calls.length, 2);
    assert.deepEqual(steps(), ['done', 'done', 'now', 'todo', 'todo']);
    await send('POST /posts and GET /feed?cursor=', 'What does a feed page hold?');
    answer = () =>
      Response.json({
        report: { rubric: { communication: 3, problem: 3, coding: null, testing: null, complexity: 2 }, verdict: 'yes', strengths: 'a', improvements: 'b', questions: [{ rating: 3, note: 'ok' }] },
        peers: { n: 41, above: { communication: 62 } },
      });
    await click([...document.querySelectorAll('.mi-steps .mi-cta')].at(-1));
    const report = calls.at(-1);
    assert.equal(report.path, '/api/oj/ai/interview-report');
    assert.equal(report.body.template, 'onsite');
    assert.equal(report.body.role, 'swe');
    assert.match($('.mi-peers').textContent, /Communication.*above 62% of similar interviews/);
    const rows = [...document.querySelectorAll('.mi-guide-scores li')].map((li) => li.textContent);
    assert.deepEqual(rows, ['RequirementsCommunication 4/4 · Problem solving 3/4Name a latency target.', 'Core entitiesSkipped']);
  } finally {
    await act(async () => root.unmount());
  }
});

test('the LLD template is offered with the AI interviewer only, and never in a custom mix', async () => {
  const root = createRoot(document.getElementById('root'));
  const names = () => [...document.querySelectorAll('.mi-template strong')].map((n) => n.textContent);
  await act2(() => root.render(createElement(MockInterview, { params: { view: 'mock-interview' }, navigate() {}, problemIds: [], ai: false })));
  assert.equal(names().includes('LLD / object-oriented design'), false);
  await act2(() => root.render(createElement(MockInterview, { params: { view: 'mock-interview', template: 'custom' }, navigate() {}, problemIds: [], ai: true })));
  assert.equal(names().includes('LLD / object-oriented design'), true);
  const counters = [...document.querySelectorAll('.mi-counter > span')].map((n) => n.textContent);
  assert.equal(counters.some((c) => c.includes('Low-level')), false);
  await act(async () => root.unmount());
});
