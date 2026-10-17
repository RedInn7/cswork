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
const { MemberStatsCard, OaOutcomesCard } = await import('../components/company-stats-card.tsx');

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
      set(form.querySelector('.xs-q-text'), 'LRU cache');
    });
    // Two more rows: one filled, one left blank (it drops out).
    await act(async () => button('Add a question').click());
    await act(async () => button('Add a question').click());
    await act(async () => set(form.querySelectorAll('.xs-q-text')[1], '  Design a feed '));
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
    assert.deepEqual(posted.questions, ['LRU cache', 'Design a feed'].map((text) => ({ text, round: '', problem: '', similar: false })));
    assert.deepEqual([posted.prepWeeks, posted.prepSources], [null, []]);
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
    interviewDate: '2026-09-01', body: 'Body with <script>alert(1)</script> text', questions: [{ text: 'Two sum', round: 'Onsite', problem: 'lc-1', similar: true }], status, note: '',
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
    // The reviewer sees each question's round and its link as stored.
    const asked = document.querySelector('.xs-card li');
    assert.equal(asked.querySelector('.xs-q-round').textContent, 'Onsite');
    assert.equal(asked.querySelector('a.xs-q-go').getAttribute('href'), '/?view=problem&problem=lc-1');
    assert.equal(asked.querySelector('a.xs-q-go').textContent, 'similar to lc-1');
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
  let doc = html({ member, questions: [{ text: 'LRU cache', round: '', problem: '', similar: false }] });
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

test('a tracker link prefills the form and clears its params; OA fields post only with an OA round', async () => {
  const year = new Date().getFullYear();
  const { calls, restore } = stub({
    'GET oj/experiences/mine': { items: [] },
    'GET oj/reports/companies': { items: [{ slug: 'amazon', name: 'Amazon' }, { slug: 'uber', name: 'Uber' }] },
    'POST oj/experiences': (body) => ({ member: { id: 'DDDDDDDDDDDD' }, slug: 'member.DDDDDDDDDDDD', title: body.title, company: { slug: 'uber', name: 'Uber' } }),
  });
  const field = (form, text) =>
    [...form.querySelectorAll('.xs-field')].find((l) => l.querySelector('span').textContent.startsWith(text))?.querySelector('input,select,textarea');
  const chip = (form, text) => [...form.querySelectorAll('.xs-chip')].find((l) => l.textContent === text).querySelector('input');
  const fill = (form) =>
    act(async () => {
      set(form.querySelector('input[minlength="4"]'), 'Uber OA then onsite');
      set(form.querySelectorAll('textarea')[0], 'An OA with three problems, then two onsite rounds. '.repeat(3));
      form.querySelector('.xs-agree input').click();
    });
  const submit = async (form) => {
    await act(async () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
    await wait();
    return calls.filter((c) => c.key === 'POST oj/experiences').at(-1).body;
  };
  try {
    // No prefill params: nothing opens, the address stays.
    dom.reconfigure({ url: 'https://cswork.test/?view=progress' });
    let root = await mount(createElement(MyExperienceSubmissions, { english: true, navigate: () => {} }));
    assert.equal(document.querySelector('form.xs-form'), null);
    assert.equal(location.search, '?view=progress');
    root.unmount();

    // ?tab=share already opened it blank; the params still fill it in.
    const role = encodeURIComponent(' Software Engineer Intern ');
    dom.reconfigure({ url: `https://cswork.test/?view=progress&tab=share&company=uber&role=${role}&employment=intern&season=${year}-fall&ref=x#top` });
    root = await mount(createElement(MyExperienceSubmissions, { english: true, navigate: () => {}, open: true }));
    let form = document.querySelector('form.xs-form');
    assert.deepEqual(
      ['Company', 'Role', 'Full-time / intern', 'Season'].map((l) => field(form, l).value),
      ['uber', 'Software Engineer Intern', 'intern', `${year}-fall`],
    );
    assert.equal(location.search, '?view=progress&tab=share&ref=x', 'the prefill params go, the rest stay');
    assert.equal(location.hash, '#top');
    // OA fields appear with the OA round; solved stops at the total.
    assert.equal(field(form, 'Problems'), undefined);
    await fill(form);
    await act(async () => chip(form, 'OA').click());
    await act(async () => {
      set(field(form, 'Problems'), '3');
      set(field(form, 'Solved'), '2');
      set(field(form, 'Test cases passed'), '85');
      set(field(form, 'Time taken'), '70');
      set(field(form, 'Did you move on?'), 'yes');
    });
    assert.equal(field(form, 'Solved').getAttribute('max'), '3');
    let posted = await submit(form);
    assert.deepEqual(
      [posted.company, posted.role, posted.employment, posted.season, posted.rounds],
      ['uber', 'Software Engineer Intern', 'intern', `${year}-fall`, ['Online Assessment']],
    );
    assert.deepEqual([posted.oaTotal, posted.oaSolved, posted.oaTestsPct, posted.oaMinutes, posted.oaNext], [3, 2, 85, 70, 'yes']);
    // The prefill is single-use: the next experience starts blank.
    await act(async () => button('Share an experience').click());
    form = document.querySelector('form.xs-form');
    assert.deepEqual(['Company', 'Role', 'Full-time / intern', 'Season'].map((l) => field(form, l).value), ['', '', '', '']);
    root.unmount();

    // Values the menus don't offer drop out; OA fields typed and then unticked post nothing.
    dom.reconfigure({ url: `https://cswork.test/?view=progress&company=nope&employment=parttime&season=${year - 5}-fall` });
    root = await mount(createElement(MyExperienceSubmissions, { english: true, navigate: () => {} }));
    form = document.querySelector('form.xs-form');
    assert.ok(form, 'the params open the form');
    assert.deepEqual(['Company', 'Role', 'Full-time / intern', 'Season'].map((l) => field(form, l).value), ['', '', '', '']);
    assert.equal(location.search, '?view=progress');
    await act(async () => {
      set(field(form, 'Company'), 'amazon');
      set(field(form, 'Role'), 'SWE');
    });
    await fill(form);
    await act(async () => chip(form, 'OA').click());
    await act(async () => set(field(form, 'Problems'), '4'));
    await act(async () => {
      chip(form, 'OA').click();
      chip(form, 'Onsite').click();
    });
    posted = await submit(form);
    assert.deepEqual(posted.rounds, ['Onsite']);
    assert.deepEqual([posted.oaTotal, posted.oaSolved, posted.oaTestsPct, posted.oaMinutes, posted.oaNext], [null, null, null, null, null]);
    root.unmount();
  } finally {
    dom.reconfigure({ url: 'https://cswork.test/?view=progress&tab=share' });
    restore();
  }
});

test('a post shows its OA line; company pages count OA outcomes, never as a rate', () => {
  const member = { id: 'CCCCCCCCCCCC', handle: null, status: 'approved', public: true, mine: false, note: '' };
  const html = (el) => new JSDOM(renderToStaticMarkup(el)).window.document;
  let doc = html(createElement(MemberPost, { member: { ...member, oa: { solved: 2, total: 3, testsPct: 85, minutes: 70, next: 'yes' } }, questions: [] }));
  assert.equal(doc.querySelector('.xs-oa').textContent, 'OA 2/3 solved · 85% of tests · 70 min · Moved on');
  doc = html(createElement(MemberPost, { member: { ...member, oa: null }, questions: [] }));
  assert.equal(doc.querySelector('.xs-oa'), null);

  const oa = { all: { n: 12, moved: 9 }, partial: null };
  doc = html(createElement(MemberStatsCard, { stats: { posts: 12, difficulty: null, sentiment: null, channel: null, weeks: null, oa }, locale: 'zh' }));
  const panel = doc.querySelector('.company-stats-oa').parentElement;
  assert.equal(doc.querySelector('.company-stats-oa').textContent, '全部 AC 的 12 篇里，9 篇说进了下一轮');
  assert.ok(panel.textContent.includes('自报样本，有偏差，不是通过率'));
  assert.ok(!panel.querySelector('.company-stats-oa').textContent.includes('%'), 'counts, not a rate');
  doc = html(createElement(OaOutcomesCard, { oa: { all: null, partial: { n: 8, moved: 1 } }, locale: 'en' }));
  assert.equal(doc.querySelector('.company-stats-oa').textContent, 'Of 8 posts that left something unsolved, 1 says they moved on');
  assert.ok(doc.querySelector('h2').textContent.includes('all companies'));
});

test('question rows post their round, link and similar; unticking a round clears it; prep goes with them', async () => {
  const { calls, restore } = stub({
    'GET oj/experiences/mine': { items: [] },
    'GET oj/reports/companies': { items: [{ slug: 'amazon', name: 'Amazon' }] },
    'POST oj/experiences': (body) => ({ member: { id: 'EEEEEEEEEEEE' }, slug: 'member.EEEEEEEEEEEE', title: body.title, company: { slug: 'amazon', name: 'Amazon' } }),
  });
  const problems = [
    { id: 'course-1', title: '课程题' },
    { id: 'lc-146', title: 'LRU 缓存', titleEn: 'LRU Cache' },
    { id: 'oa-amazon-3', title: 'Amazon OA 3' },
    ...Array.from({ length: 30 }, (_, i) => ({ id: `lc-${i + 1}`, title: `题${i + 1}` })),
  ];
  const chip = (form, text) => [...form.querySelectorAll('.xs-chip')].find((l) => l.textContent === text).querySelector('input');
  const rows = (form) => [...form.querySelectorAll('.xs-q-row')];
  const options = (select) => [...select.querySelectorAll('option')].map((o) => o.value);
  try {
    dom.reconfigure({ url: 'https://cswork.test/?view=progress' });
    const root = await mount(createElement(MyExperienceSubmissions, { english: true, navigate: () => {}, open: true, problems }));
    const form = document.querySelector('form.xs-form');
    await act(async () => {
      set(form.querySelector('select'), 'amazon');
      set(form.querySelector('input[list]'), 'SWE');
      set(form.querySelector('input[minlength="4"]'), 'Amazon OA and onsite');
      set(form.querySelectorAll('textarea')[0], 'An OA with two problems, then an onsite with coding rounds. '.repeat(3));
      form.querySelector('.xs-agree input').click();
    });
    // The round menu offers only the ticked rounds, in order.
    assert.deepEqual(options(rows(form)[0].querySelector('select')), ['']);
    await act(async () => {
      chip(form, 'Onsite').click();
      chip(form, 'OA').click();
    });
    assert.deepEqual(options(rows(form)[0].querySelector('select')), ['', 'Online Assessment', 'Onsite']);
    // The problem list: LeetCode and OA ids only, 20 at most, narrowed by what is typed.
    const list = (row) => [...document.getElementById(row.querySelector('.xs-q-problem').getAttribute('list')).querySelectorAll('option')];
    assert.equal(list(rows(form)[0]).length, 20);
    assert.ok(!list(rows(form)[0]).some((o) => o.value === 'course-1'));
    const similar = (row) => row.querySelector('.xs-q-similar input');
    assert.equal(similar(rows(form)[0]).disabled, true, 'similar needs a link');
    await act(async () => {
      set(rows(form)[0].querySelector('.xs-q-text'), 'LRU cache');
      set(rows(form)[0].querySelector('select'), 'Onsite');
      set(rows(form)[0].querySelector('.xs-q-problem'), 'lru');
    });
    assert.deepEqual(list(rows(form)[0]).map((o) => [o.value, o.textContent]), [['lc-146', 'LRU Cache']]);
    await act(async () => set(rows(form)[0].querySelector('.xs-q-problem'), 'lc-146'));
    await act(async () => similar(rows(form)[0]).click());
    await act(async () => button('Add a question').click());
    await act(async () => {
      set(rows(form)[1].querySelector('.xs-q-text'), 'Two sum');
      set(rows(form)[1].querySelector('select'), 'Online Assessment');
    });
    // Unticking OA clears that question's round and drops it from the menus.
    await act(async () => chip(form, 'OA').click());
    assert.equal(rows(form)[1].querySelector('select').value, '');
    assert.deepEqual(options(rows(form)[1].querySelector('select')), ['', 'Onsite']);
    assert.equal(rows(form)[0].querySelector('select').value, 'Onsite', 'other rounds stay');
    // A third row, removed again.
    await act(async () => button('Add a question').click());
    await act(async () => rows(form)[2].querySelector('.xs-quiet').click());
    assert.equal(rows(form).length, 2);
    // How I prepared.
    const weeks = [...form.querySelectorAll('.xs-field')].find((l) => l.querySelector('span').textContent === 'Weeks of preparation').querySelector('input');
    await act(async () => {
      set(weeks, '6');
      chip(form, 'Mock interviews').click();
      chip(form, 'LeetCode').click();
    });
    await act(async () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
    await wait();
    const posted = calls.find((c) => c.key === 'POST oj/experiences').body;
    assert.deepEqual(posted.questions, [
      { text: 'LRU cache', round: 'Onsite', problem: 'lc-146', similar: true },
      { text: 'Two sum', round: '', problem: '', similar: false },
    ]);
    assert.deepEqual(posted.rounds, ['Onsite']);
    assert.deepEqual([posted.prepWeeks, posted.prepSources], [6, ['leetcode', 'mock']]);
    root.unmount();
  } finally {
    dom.reconfigure({ url: 'https://cswork.test/?view=progress&tab=share' });
    restore();
  }
});

test('a post links its questions to practise and offers the loop as a mock; company pages show prep among offers', () => {
  const member = { id: 'CCCCCCCCCCCC', handle: null, status: 'approved', public: true, mine: false, note: '' };
  const questions = [
    { text: 'LRU cache', round: 'Onsite', problem: 'lc-146', similar: true, title: 'LRU 缓存', titleEn: 'LRU Cache' },
    { text: 'Tell me about a conflict', round: '', problem: '', similar: false },
  ];
  const html = (el) => new JSDOM(renderToStaticMarkup(el)).window.document;
  let doc = html(createElement(MemberPost, { member, questions }));
  const items = doc.querySelectorAll('.xs-questions li');
  assert.equal(items[0].querySelector('.xs-q-round').textContent, 'Onsite');
  const go = items[0].querySelector('a.xs-q-go');
  assert.equal(go.getAttribute('href'), '/?view=problem&problem=lc-146');
  assert.equal(go.textContent, 'Practise LC 146 · LRU Cache (similar)');
  assert.equal(items[1].textContent, 'Tell me about a conflict');
  assert.equal(doc.querySelector('a.xs-loop').getAttribute('href'), '/?view=mock&experience=CCCCCCCCCCCC');
  // In review (not public): no mock to draw yet; nothing linked: none either.
  doc = html(createElement(MemberPost, { member: { ...member, public: false, status: 'pending', mine: true }, questions }));
  assert.equal(doc.querySelector('a.xs-loop'), null);
  doc = html(createElement(MemberPost, { member, questions: [questions[1]] }));
  assert.equal(doc.querySelector('a.xs-loop'), null);

  doc = html(createElement(MemberStatsCard, {
    stats: { posts: 9, difficulty: null, sentiment: null, channel: null, weeks: null, prep: { n: 5, median: 6 }, oa: null },
    locale: 'en',
  }));
  const figure = [...doc.querySelectorAll('.company-stats-figures > div')].find((d) => d.textContent.includes('prep'));
  assert.equal(figure.querySelector('dt').textContent, 'Median prep among offers (5 posts)');
  assert.equal(figure.querySelector('dd').textContent, '6 weeks');
});
