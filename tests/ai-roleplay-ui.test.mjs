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
const { setLocale } = await import('../lib/i18n.ts');

const set = {
  seed: 'k3x9q2ab',
  rerolls: [],
  template: { id: 'negotiation', name: ['Offer 谈判', 'Offer negotiation'] },
  slots: [
    {
      kind: 'negotiation', minutes: 20, similar: false, pool: 15,
      item: {
        id: 'rp-neg-cloud-newgrad', type: 'roleplay', slug: 'neg-cloud-newgrad', title: 'Backend Software Engineer · New grad',
        titleZh: '后端软件工程师 · 新毕业生', company: null, role: null, round: null, category: 'Offer Negotiation', difficulty: null,
        problem: null, math: false, principles: [], question: 'EN-SCENARIO', questionZh: 'ZH-SCENARIO',
        hints: '', followUps: '', rubric: '', solution: '',
      },
    },
  ],
};
const params = { view: 'mock-interview', template: 'negotiation', set: 'k3x9q2ab', as: 'ai' };
const calls = [];
let answer;
globalThis.fetch = async (url, init = {}) => {
  const path = String(url);
  if (path === '/api/metrics') return new Response(null, { status: 204 });
  if (path.startsWith('/api/content/mock?')) return Response.json(set);
  calls.push({ path, body: JSON.parse(init.body) });
  return answer(path);
};

const root = createRoot(document.getElementById('root'));
const settle = () => new Promise((r) => setTimeout(r, 0));
const $ = (selector) => document.querySelector(selector);
const act2 = (fn) =>
  act(async () => {
    fn();
    await settle();
    await settle();
  });

test('a negotiation role-play: rate yourself before the report, then see your score beside the interviewer’s', async () => {
  await act(async () => {
    root.render(createElement(MockInterview, { params, navigate: () => {}, problemIds: [], userId: 'u1', ai: true }));
    await settle();
  });
  assert.equal($('.mi-question h2').textContent, 'Backend Software Engineer · New grad');
  assert.equal($('.mi-question').textContent.includes('EN-SCENARIO'), true);
  assert.match($('.mi-ai-log li').textContent, /written offer/);
  // Nothing to rate before the conversation starts.
  assert.equal($('#mi-self-title'), null);

  await act(async () => {
    const box = $('#mi-ai-input');
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(box, 'Could you do better on base?');
    box.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  answer = () => Response.json({ text: 'Do you have other offers?', ticket: 'T1' });
  await act2(() => $('.mi-ai-compose').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
  assert.equal(calls[0].body.itemId, 'rp-neg-cloud-newgrad');

  // The self-assessment covers the role-play's dimensions only, and is optional.
  assert.equal($('#mi-self-title').textContent, 'Rate yourself first (optional)');
  const legends = [...document.querySelectorAll('.mi-self legend')].map((l) => l.firstChild.textContent);
  assert.deepEqual(legends, ['Communication', 'Motivation & fit', 'Anchoring', 'Leverage']);
  const pick = (dim, n) => {
    const fieldset = [...document.querySelectorAll('.mi-self fieldset')].find((f) => f.querySelector('legend').firstChild.textContent === dim);
    return act2(() => fieldset.querySelectorAll('input')[n - 1].click());
  };
  await pick('Communication', 4);
  await pick('Anchoring', 2);

  answer = () =>
    Response.json({
      report: {
        rubric: { communication: 3, motivation: 2, anchoring: 4, leverage: null },
        verdict: 'yes', strengths: 'Asked for their range.', improvements: 'Use the competing offer.', questions: [{ rating: 3, note: 'Good.' }],
      },
    });
  const finish = [...document.querySelectorAll('.mi-steps .mi-cta')].at(-1);
  await act2(() => finish.click());
  const report = calls.at(-1);
  assert.equal(report.path, '/api/oj/ai/interview-report');
  assert.deepEqual(report.body.self, { communication: 4, anchoring: 2 });
  assert.equal(report.body.template, 'negotiation');

  // The report: the role-play's dimensions, yours beside the interviewer's with the gap.
  assert.deepEqual(
    [...document.querySelectorAll('.mi-fb-rubric dt')].map((dt) => dt.textContent),
    ['Communication', 'Motivation & fit', 'Anchoring', 'Leverage'],
  );
  assert.deepEqual(
    [...document.querySelectorAll('.mi-fb-self')].map((dd) => dd.textContent),
    ['You: 4 · Interviewer: 3 · Gap +1', 'You: 2 · Interviewer: 4 · Gap -2'],
  );
  // The verdict rates the conversation, not a hire.
  assert.equal($('.mi-fb-verdict').textContent, 'Handled well');
  assert.equal($('.mi-fb-q').textContent, 'Backend Software Engineer · New grad');
  const [saved] = JSON.parse(localStorage.getItem('cswork:mock-interview:history'));
  assert.deepEqual(saved.aiSelf, { communication: 4, anchoring: 2 });
  assert.equal(saved.items[0].titleZh, '后端软件工程师 · 新毕业生');
  // In Chinese, the report and the summary use the role-play's Chinese title.
  await act2(() => setLocale('zh'));
  assert.equal($('.mi-fb-verdict').textContent, '处理得不错');
  assert.equal($('.mi-fb-q').textContent, '后端软件工程师 · 新毕业生');
  assert.match($('.mi-table tbody').textContent, /后端软件工程师 · 新毕业生/);
  await act(async () => root.unmount());
});

test('without the AI interviewer, a role-play set points to the practice scripts', async () => {
  const fresh = createRoot(document.getElementById('root'));
  const { as: _, ...solo } = params;
  await act(async () => {
    fresh.render(createElement(MockInterview, { params: solo, navigate: () => {}, problemIds: [], ai: false }));
    await settle();
  });
  assert.ok($('.mi-start a[href="/career/negotiation"]'));
  await act(async () => fresh.unmount());
});
