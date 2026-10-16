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
const { RESUME_KEY } = await import('../components/resume-builder.tsx');

const set = {
  seed: 'p4ro8jxy',
  rerolls: [],
  template: { id: 'project', name: ['简历项目深挖', 'Resume project deep dive'] },
  slots: [
    {
      kind: 'project', minutes: 30, similar: false, pool: 1,
      item: {
        id: 'project-deep-dive', type: 'extra', slug: 'project-deep-dive', title: 'Resume project deep dive', titleZh: '简历项目深挖',
        company: null, role: null, round: null, category: 'Project Deep Dive', difficulty: null, problem: null, math: false,
        principles: [], question: 'Pick the project on your resume you know best.', questionZh: '从你的简历里挑一个项目。',
        hints: '', followUps: '', rubric: '', solution: '',
      },
    },
  ],
};
const params = { view: 'mock-interview', template: 'project', set: 'p4ro8jxy', as: 'ai' };
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
const type = (el, value) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
const act2 = (fn) =>
  act(async () => {
    fn();
    await settle();
    await settle();
  });

test('a project deep dive starts from the builder resume, without name or contact, and sends it with turns and the report', async () => {
  localStorage.setItem(
    RESUME_KEY,
    JSON.stringify({
      name: 'Ada Lovelace', email: 'ada@example.test', phone: '555-0100',
      projects: [{ title: 'Price cache', subtitle: 'Redis', dates: '2025', bullets: '- Cut checkout latency 40%' }],
    }),
  );
  await act(async () => {
    root.render(createElement(MockInterview, { params, navigate: () => {}, problemIds: [], userId: 'u1', ai: true }));
    await settle();
    await settle();
  });
  const box = () => $('.mi-work-main .mi-notes textarea');
  assert.equal(box().value, 'PROJECTS\nPrice cache | Redis | 2025\n- Cut checkout latency 40%');
  assert.equal(box().getAttribute('aria-describedby'), 'mi-resume-note');
  assert.equal($('#mi-resume-note').textContent.includes('never stores it'), true);
  // The interviewer opens on the project, and the round has no code box.
  assert.equal($('.mi-ai-log li').textContent.includes('project from your resume'), true);
  await type(box(), 'PROJECTS\nPrice cache\n- Cut checkout latency 40% with Redis');

  answer = () => Response.json({ text: 'Which part was yours?', ticket: 'T1' });
  await type($('#mi-ai-input'), 'The price cache.');
  await act2(() => $('.mi-ai-compose').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
  assert.equal(calls[0].path, '/api/oj/ai/interview');
  assert.equal(calls[0].body.resume, 'PROJECTS\nPrice cache\n- Cut checkout latency 40% with Redis');
  assert.equal(calls[0].body.code, '');
  // Once the interview is under way the box is gone; the resume stays with the sitting.
  assert.equal($('#mi-resume-note'), null);

  answer = () =>
    Response.json({
      report: { rubric: { communication: 3 }, verdict: 'yes', strengths: 'Owned it.', improvements: 'Measure.', questions: [{ rating: 3, note: 'Good.' }] },
    });
  const finish = [...document.querySelectorAll('.mi-steps button')].at(-1);
  await act2(() => finish.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
  assert.equal(calls[1].path, '/api/oj/ai/interview-report');
  assert.equal(calls[1].body.resume, 'PROJECTS\nPrice cache\n- Cut checkout latency 40% with Redis');
  assert.equal(calls[1].body.template, 'project');
  await act(async () => root.unmount());
});
