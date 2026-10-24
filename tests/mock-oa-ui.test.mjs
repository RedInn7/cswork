import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup as renderMarkup } from 'react-dom/server';
import { register } from 'node:module';
register(
  `data:text/javascript,${encodeURIComponent("export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'export default {}',shortCircuit:true};return n(u,c);}")}`,
  import.meta.url,
);
const { MockExamBar } = await import('../components/mock-exam-bar.tsx');
const { MockOa, MockTopicBrief } = await import('../components/mock-oa.tsx');
const { LocaleProvider } = await import('../lib/i18n.ts');
// These assertions read the English copy; the site default is Chinese.
const renderToStaticMarkup = (el) => renderMarkup(createElement(LocaleProvider, { locale: 'en' }, el));

const session = (startedAt) => ({
  id: 's1',
  company: 'tiktok',
  name: 'TikTok / ByteDance',
  platform: 'CodeSignal',
  preset: true,
  scoring: 'gca',
  source: 'mixed',
  slots: ['easy', 'easy', 'medium'],
  ids: ['lc-1', 'lc-2', 'oa-tiktok-3'],
  minutes: 70,
  skew: 0,
  createdAt: startedAt,
  startedAt,
});

test('the exam strip shows each question state, the countdown and the 5-minute warning', () => {
  const start = Date.now() - 66 * 60000;
  const html = renderToStaticMarkup(
    createElement(MockExamBar, {
      session: session(start),
      userId: 'u1',
      problemId: 'lc-2',
      navigate() {},
      submissions: [
        { problem_id: 'lc-1', status: 'accepted', created_at: start + 60000 },
        { problem_id: 'lc-2', status: 'wrong_answer', created_at: start + 120000 },
        // Before the exam: does not count.
        { problem_id: 'oa-tiktok-3', status: 'accepted', created_at: start - 3600000 },
      ],
    }),
  );
  assert.match(html, /data-warn="5"/);
  assert.match(html, /<li data-state="ac"><button[^>]*aria-label="Q1, accepted"/);
  assert.match(html, /<li data-state="tried"><button[^>]*aria-current="step"[^>]*aria-label="Q2, attempted"/);
  assert.match(html, /<li data-state="todo"><button[^>]*aria-label="Q3, not started"/);
  assert.match(html, /role="timer"[^>]*>0[34]:\d\d</);
  assert.match(html, /aria-live="polite"[^>]*>Last 5 min</);
  assert.match(html, /TikTok \/ ByteDance/);
});

test('single-submit rules: the exam strip says submitted, never accepted', () => {
  const start = Date.now() - 10 * 60000;
  const html = renderToStaticMarkup(
    createElement(MockExamBar, {
      session: { ...session(start), scoring: 'codility', preset: false },
      userId: 'u1',
      problemId: 'lc-2',
      navigate() {},
      submissions: [
        { problem_id: 'lc-1', status: 'accepted', created_at: start + 60000 },
        // A judge failure is not the question's one submission.
        { problem_id: 'lc-2', status: 'system_error', created_at: start + 120000 },
      ],
    }),
  );
  assert.doesNotMatch(html, /data-state="ac"|accepted/);
  assert.match(html, /<li data-state="tried"><button[^>]*aria-label="Q1, submitted"/);
  assert.match(html, /<li data-state="todo"><button[^>]*aria-label="Q2, not started"/);
});

test('early in the exam there is no warning; guests can open the mock landing', () => {
  const html = renderToStaticMarkup(
    createElement(MockExamBar, {
      session: session(Date.now()),
      userId: 'u1',
      problemId: 'lc-1',
      navigate() {},
      submissions: [],
    }),
  );
  assert.doesNotMatch(html, /data-warn/);
  assert.match(html, /role="timer"[^>]*>1:10:00</);
  const landing = renderToStaticMarkup(
    createElement(MockOa, {
      boot: { person: null, courses: [], problems: [], progress: [], submissions: [], notifications: [], services: {} },
      params: { view: 'mock' },
      navigate() {},
    }),
  );
  assert.match(landing, /aria-pressed="true">Mock OA/);
  assert.match(landing, /One click draws a real-format OA/);
  assert.match(landing, /aria-busy="true"/, 'company cards load after the presets request');
  assert.match(landing, /Finished mocks show up here/);
});

test('the check-in says what the OA tests and links its topics to their Line 500 stops', () => {
  const preset = {
    topics: [
      { slug: 'greedy-scheduling', weight: 1 },
      { slug: 'simulation', weight: 0.5 },
    ],
    focus_zh: '贪心',
    focus_en: 'Greedy with sorting.',
    style_zh: '故事',
    style_en: 'Long stories.',
    tips_zh: '先看范围',
    tips_en: 'Check the constraints.',
    evidence: 'thin',
  };
  const html = renderToStaticMarkup(createElement(MockTopicBrief, { preset, navigate() {} }));
  assert.match(html, /What this OA tests/);
  assert.match(html, /Greedy with sorting\./);
  assert.match(html, /Long stories\./);
  assert.match(html, /Check the constraints\./);
  assert.match(html, /<a href="\/\?view=problems&amp;section=greedy-scheduling">Greedy<\/a>/);
  // Simulation is not a Line 500 stop: named, not linked.
  assert.match(html, /<span>Simulation<\/span>/);
  assert.match(html, /--w:0\.5/);
  assert.match(html, /weight 50%/);
  assert.match(html, /little public information/);
  const solid = renderToStaticMarkup(
    createElement(MockTopicBrief, { preset: { ...preset, evidence: 'data+reports' }, navigate() {} }),
  );
  assert.doesNotMatch(solid, /little public information/);
});

test('a ?section= link opens Line 500 on that stop; anything else opens the whole line', async () => {
  const { stopFromUrl, stopHref, topicName } = await import('../lib/route-stops.ts');
  assert.equal(stopFromUrl(), '', 'no location on the server');
  try {
    for (const [search, stop] of [
      ['?view=problems&section=binary-search', 'binary-search'],
      ['?view=problems&section=simulation', ''],
      ['?view=problems&section=__proto__', ''],
      ['?view=problems', ''],
    ]) {
      globalThis.location = { search };
      assert.equal(stopFromUrl(), stop, search);
    }
  } finally {
    delete globalThis.location;
  }
  assert.equal(stopHref('sql'), null);
  assert.equal(topicName('sql', true), 'SQL');
  assert.equal(topicName('simulation', true), '模拟/实现');
  assert.equal(topicName('made-up', false), 'made-up');
});

test('?rules=codility preselects single-submit rules; the draw, the check-in and a new draw keep them', async () => {
  const { JSDOM } = await import('jsdom');
  const { act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/?view=mock&rules=codility' });
  dom.window.localStorage.setItem('cswork:locale', 'en');
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'navigator', 'location', 'StorageEvent'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const draws = [],
    reports = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (url.endsWith('mock-oa/presets')) return Response.json({ companies: [], others: [], all: { oa: 9, lc: 9 } });
    if (url.includes('mock-oa/report?')) {
      reports.push(new URL(url, 'https://cswork.test').searchParams);
      const item = (id, best, groups) => ({ id, attempts: best ? 2 : 0, best, firstAcceptedMs: null, pending: false, estimate: null, groups });
      return Response.json({
        items: [item('lc-1', { passed: 7, total: 10, accepted: false, status: 'time_limit', score: 80 }, { correctness: 100, performance: 60 }), item('lc-2', null)],
        score: { value: 80, min: 0, max: 200, per: [80, 0], estimate: false },
        scoring: 'codility',
        pending: false,
        peers: null,
      });
    }
    if (url.endsWith('mock-oa/draw')) {
      draws.push(JSON.parse(init.body));
      const { custom } = draws.at(-1);
      return Response.json({ ids: ['lc-1', 'lc-2'], company: null, name: null, platform: null, preset: false, minutes: custom.minutes, slots: custom.slots, scoring: custom.rules === 'codility' ? 'codility' : 'tests', source: custom.source, now: Date.now() });
    }
    return Response.json({ items: [] });
  };
  const boot = { person: { id: 'u1', verified: true, role: 'student' }, courses: [], problems: [{ id: 'lc-1' }, { id: 'lc-2' }], progress: [], submissions: [], notifications: [], services: {} };
  const moves = [];
  const root = createRoot(document.getElementById('root'));
  const show = (params) => act(async () => root.render(createElement(MockOa, { boot, params, navigate: (...a) => moves.push(a) })));
  const settle = () => act(async () => new Promise((r) => setTimeout(r, 30)));
  try {
    await show({ view: 'mock', rules: 'codility' });
    await settle();
    const form = document.querySelector('.mock-custom form');
    const checked = [...form.querySelectorAll('input[type="radio"]:checked')].map((n) => n.parentElement.textContent);
    assert.deepEqual(checked.slice(0, 2), ['Single submit', '2']);
    assert.equal(form.querySelectorAll('select')[1].value, '120', 'two hours by default');
    assert.match(form.querySelector('.mock-rules-note').textContent, /one formal submission per question/);
    await act(async () => form.querySelector('button[type="submit"]').click());
    await settle();
    assert.deepEqual([draws[0].custom.rules, draws[0].custom.questions, draws[0].custom.minutes], ['codility', 2, 120]);
    const active = JSON.parse(localStorage.getItem('cswork:mock:v1:u1')).active;
    assert.equal(active.scoring, 'codility');
    assert.deepEqual(moves.at(-1), ['mock', { session: active.id }]);
    await show({ view: 'mock', session: active.id });
    await settle();
    const briefing = document.querySelector('.mock-briefing').textContent;
    assert.match(briefing, /2 coding questions · Single submit/);
    assert.match(briefing, /Each question takes one formal submission and shows no result until you hand in/);
    await act(async () => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Redraw')).click());
    await settle();
    assert.equal(draws[1].custom.rules, 'codility', 'a redraw keeps the rules');
    // Without the link the rules start standard; picking single submit sets 2 questions and 120 minutes.
    await show({ view: 'mock' });
    await settle();
    const rules = () => document.querySelectorAll('.mock-custom input[name="mock-rules"]');
    assert.equal(rules()[0].checked, true);
    assert.equal(document.querySelectorAll('.mock-custom select')[1].value, '90');
    await act(async () => rules()[1].click());
    assert.equal(document.querySelectorAll('.mock-custom select')[1].value, '120');
    assert.ok(document.querySelector('.mock-rules-note'));
    await act(async () => rules()[0].click());
    assert.equal(document.querySelector('.mock-rules-note'), null);

    // The report asks for single-submit scoring and says only first submissions count.
    const done = { ...active, id: 'done-1', startedAt: Date.now() - 3600000, finishedAt: Date.now() - 600000, reason: 'manual' };
    localStorage.setItem('cswork:mock:v1:u1', JSON.stringify({ active: null, history: [done] }));
    await act(async () => window.dispatchEvent(new StorageEvent('storage', { key: null })));
    await show({ view: 'mock', report: done.id });
    await settle();
    assert.equal(reports.at(-1).get('scoring'), 'codility');
    assert.match(document.querySelector('.mock-score').textContent, /only the first submission of each question counts/);
    const q1 = document.querySelector('.mock-results li').textContent;
    assert.match(q1, /Correctness 100% · Performance 60% · correct but too slow/);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = realFetch;
    dom.window.close();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
