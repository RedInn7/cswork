import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

register(
  `data:text/javascript,${encodeURIComponent(
    `export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}`,
  )}`,
  import.meta.url,
);

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/?view=progress&tab=share' });
for (const name of [
  'window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent',
  'FocusEvent', 'getComputedStyle', 'localStorage', 'sessionStorage', 'navigator', 'location',
])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] ?? dom.window.MouseEvent });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame ??= (cb) => setTimeout(cb, 0);
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
const { createRoot } = await import('react-dom/client');
const { MyExperienceSubmissions } = await import('../components/experience-submissions.tsx');
const { ExperienceReview } = await import('../components/experience-review.tsx');
const { MemberPost, ReportExperience } = await import('../components/experience-report.tsx');

const wait = (ms = 5) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(text));
function set(element, value) {
  const proto = { TEXTAREA: dom.window.HTMLTextAreaElement, SELECT: dom.window.HTMLSelectElement }[element.tagName] ?? dom.window.HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(element, value);
  element.dispatchEvent(new dom.window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
}
async function mount(element) {
  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(element));
  await wait();
  return root;
}
/** fetch stub: `routes` maps "METHOD path" to a JSON answer; every call is recorded. */
function stub(routes) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const key = `${init.method || 'GET'} ${(typeof url === 'string' ? url : url.url).replace('/api/', '')}`;
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ key, body });
    const answer = routes[key];
    const value = typeof answer === 'function' ? answer(body) : answer;
    return new Response(JSON.stringify(value ?? { error: 'missing' }), { status: value ? 200 : 404 });
  };
  return { calls, restore: () => (globalThis.fetch = original) };
}

test('sharing an experience: the form posts ordered rounds and split questions, the list shows the status', async () => {
  const { calls, restore } = stub({
    'GET oj/experiences/mine': {
      items: [
        { id: 'AAAAAAAAAAAA', slug: 'member.AAAAAAAAAAAA', title: 'Old post', company: { slug: 'amazon', name: 'Amazon' }, status: 'rejected', note: 'Covered by an NDA', month: '2026-01', createdAt: 1 },
      ],
    },
    'GET oj/reports/companies': { items: [{ slug: 'amazon', name: 'Amazon' }, { slug: 'uber', name: 'Uber' }] },
    'POST oj/experiences': (body) => ({ member: { id: 'BBBBBBBBBBBB' }, slug: 'member.BBBBBBBBBBBB', title: body.title, company: { slug: 'uber', name: 'Uber' } }),
    'POST oj/experiences/AAAAAAAAAAAA/withdraw': { id: 'AAAAAAAAAAAA', deleted: true },
  });
  const navigated = [];
  try {
    const root = await mount(createElement(MyExperienceSubmissions, { english: true, navigate: (...a) => navigated.push(a), open: true }));
    assert.ok(document.querySelector('.xs-note').textContent.includes('Covered by an NDA'));
    assert.equal(document.querySelector('.xs-status').getAttribute('data-status'), 'rejected');
    const form = document.querySelector('form.xs-form');
    assert.ok(form !== null, 'tab=share opens the form');
    assert.equal(form.querySelector('select').querySelectorAll('option').length, 3, 'the company menu');
    await act(async () => {
      set(form.querySelector('select'), 'uber');
      set(form.querySelector('input[list]'), 'Software Engineer');
      set(form.querySelector('input[minlength="4"]'), '  Uber onsite  ');
      set(form.querySelectorAll('textarea')[0], 'Coding, design and behavioral rounds. '.repeat(4));
      set(form.querySelectorAll('textarea')[1], 'LRU cache\n\n  Design a feed \n');
    });
    // No round picked: the form says so instead of posting.
    await act(async () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
    assert.ok(document.querySelector('.xs-error[role="alert"]').textContent.includes('round'));
    assert.equal(calls.filter((c) => c.key === 'POST oj/experiences').length, 0);
    const chip = (text) => [...form.querySelectorAll('.xs-chip')].find((l) => l.textContent === text).querySelector('input');
    await act(async () => {
      chip('Onsite').click();
      chip('OA').click();
      chip('Offer').click();
      form.querySelector('.xs-agree input').click();
    });
    await act(async () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
    await wait();
    const posted = calls.find((c) => c.key === 'POST oj/experiences').body;
    assert.deepEqual(posted.rounds, ['Online Assessment', 'Onsite']);
    assert.deepEqual(posted.questions, ['LRU cache', 'Design a feed']);
    assert.equal(posted.title, 'Uber onsite');
    assert.equal(posted.result, 'Offer');
    assert.equal(posted.agree, true);
    assert.equal(posted.anonymous, false, 'named unless chosen');
    assert.ok(/^\d{4}-\d{2}$/.test(posted.month));
    assert.ok(document.querySelector('form.xs-form') === null, 'the form closes');
    const statuses = [...document.querySelectorAll('.xs-status')].map((s) => s.getAttribute('data-status'));
    assert.deepEqual(statuses, ['pending', 'rejected']);
    // Withdrawing asks first, then removes the row.
    globalThis.confirm = dom.window.confirm = () => true;
    await act(async () => [...document.querySelectorAll('.xs-link')][1].click());
    await wait();
    assert.ok(calls.some((c) => c.key === 'POST oj/experiences/AAAAAAAAAAAA/withdraw'));
    assert.equal(document.querySelectorAll('.xs-list li').length, 1);
    await act(async () => document.querySelector('.xs-list a').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })));
    assert.deepEqual(navigated[0], ['content', { type: 'experience', slug: 'member.BBBBBBBBBBBB' }]);
    root.unmount();
  } finally {
    restore();
  }
});

test('the review queue: rejecting needs a note, approving posts the decision', async () => {
  const item = (id, status, extra = {}) => ({
    id, title: `Post ${id}`, company: { slug: 'amazon', name: 'Amazon' }, role: 'SWE', result: 'Offer', rounds: ['Onsite'],
    interviewDate: '2026-09-01', body: 'Body with <script>alert(1)</script> text', questions: ['Two sum'], status, note: '',
    createdAt: 1, flags: 0, reasons: [], shown: true, member: { handle: null }, ...extra,
  });
  const details = { difficulty: 4, sentiment: 'neg', channel: 'referral', employment: 'intern', season: '2026-summer', location: 'WeChat abc123', durationWeeks: null, verified: true };
  const queue = { pending: [item('P1', 'pending', { details })], flagged: [item('F1', 'approved', { flags: 3, reasons: ['nda: leaked'] })], approved: [] };
  const { calls, restore } = stub({
    'GET oj/experiences/review': queue,
    'POST oj/experiences/P1/review': { pending: [], flagged: queue.flagged, approved: [item('P1', 'approved')] },
  });
  try {
    const root = await mount(createElement(ExperienceReview));
    assert.equal(document.querySelectorAll('.xs-card').length, 2);
    assert.ok(document.querySelector('script') === null, 'raw HTML in a post stays text');
    assert.ok(document.querySelector('.xs-flags').textContent.includes('nda: leaked'));
    const facts = document.querySelector('.xs-card-facts')?.textContent ?? '';
    assert.ok(facts.includes('Location: WeChat abc123') && facts.includes('Referral') && facts.includes('Difficulty 4/5'), facts);
    assert.ok(document.querySelectorAll('.xs-card-facts').length === 1, 'a post without facts shows no row');
    assert.equal(button('Reject').disabled, true);
    await act(async () => set(document.querySelector('.xs-card textarea'), 'Too short'));
    assert.equal(button('Reject').disabled, false);
    await act(async () => button('Approve and publish').click());
    await wait();
    assert.deepEqual(calls.find((c) => c.key === 'POST oj/experiences/P1/review').body, { status: 'approved', note: 'Too short' });
    assert.ok(button('Approve and publish') === undefined);
    assert.ok(button('Keep and clear reports') !== undefined && button('Take down') !== undefined);
    root.unmount();
  } finally {
    restore();
  }
});

test('a post the markdown renderer chokes on shows as plain text and can still be rejected', async () => {
  const body = `${'>'.repeat(5000)} nested past the stack`;
  const queue = {
    pending: [{
      id: 'P2', title: 'Deep', company: { slug: 'amazon', name: 'Amazon' }, role: 'SWE', result: null, rounds: [],
      interviewDate: null, body, questions: [], status: 'pending', note: '', createdAt: 1, flags: 0, reasons: [], shown: true,
      member: { handle: null },
    }],
    flagged: [],
    approved: [],
  };
  const { calls, restore } = stub({ 'GET oj/experiences/review': queue, 'POST oj/experiences/P2/review': { pending: [], flagged: [], approved: [] } });
  const quiet = console.error;
  console.error = () => {};
  try {
    const root = await mount(createElement(ExperienceReview));
    assert.ok(document.querySelector('pre.xs-plain')?.textContent === body);
    await act(async () => set(document.querySelector('.xs-card textarea'), 'Unreadable'));
    await act(async () => button('Reject').click());
    await wait();
    assert.ok(calls.some((c) => c.key === 'POST oj/experiences/P2/review' && c.body.status === 'rejected'));
    root.unmount();
  } finally {
    console.error = quiet;
    restore();
  }
});

test('a member post shows its status to the author and a report control to other readers', async () => {
  const member = { id: 'CCCCCCCCCCCC', handle: null, status: 'approved', public: true, mine: false, note: '' };
  const html = (props) => new JSDOM(renderToStaticMarkup(createElement(MemberPost, props))).window.document;
  let doc = html({ member, questions: ['LRU cache'] });
  assert.ok(doc.querySelector('details.xs-report') !== null);
  assert.ok(doc.querySelector('a[href="/library/experience-ugc/CCCCCCCCCCCC"]') !== null);
  assert.equal(doc.querySelector('.xs-questions li').textContent, 'LRU cache');
  assert.ok(doc.querySelector('.xs-notice') === null);
  doc = html({ member: { ...member, status: 'pending', public: false, mine: true, note: 'Fix the title' }, questions: [] });
  assert.ok(doc.querySelector('details.xs-report') === null);
  assert.ok(doc.querySelector('.xs-notice').textContent.includes('Fix the title'));
  assert.ok(doc.querySelector('.xs-questions') === null);

  const { calls, restore } = stub({ 'POST oj/experiences/CCCCCCCCCCCC/flag': { id: 'CCCCCCCCCCCC', flagged: true } });
  try {
    const root = await mount(createElement(ReportExperience, { id: 'CCCCCCCCCCCC' }));
    assert.equal(button('Send report').disabled, true);
    await act(async () => set(document.querySelector('select'), 'nda'));
    await act(async () => document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
    await wait();
    assert.deepEqual(calls[0].body, { reason: 'nda', note: '' });
    assert.ok(document.querySelector('output.xs-report') !== null);
    root.unmount();
  } finally {
    restore();
  }
});
