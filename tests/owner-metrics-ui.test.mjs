import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

register(
  `data:text/javascript,${encodeURIComponent("export async function load(url, context, next) { if (url.endsWith('.css')) return {format:'module',source:'export default {}',shortCircuit:true}; return next(url,context); }")}`,
  import.meta.url,
);

const day = (d, n) => ({
  day: `2026-10-${String(d).padStart(2, '0')}`,
  pageViews: 1000 + n * 100,
  visitors: 200 + n * 10,
  signups: n,
  submissions: 50 + n,
  runs: 120,
  accepted: 30 + n,
});
const summary = (days) => ({
  range: { days, from: '2026-10-04', to: '2026-10-10' },
  generatedAt: Date.UTC(2026, 9, 10, 12, 5),
  totals: {
    pageViews: days === 30 ? 54321 : 12345,
    visitors: 2345,
    signups: 67,
    submissions: 400,
    runs: 890,
    accepted: 250,
    judgeErrors: 3,
  },
  daily: [4, 5, 6, 7, 8, 9, 10].map((d, i) => day(d, i)),
  judge: {
    server: { count: 400, p50: days === 30 ? 2500 : 1800, p90: 3200, p99: 6100, avg: 2000 },
    client: { count: 380, p50: 2400, p90: 4000, p99: 8300 },
    run: { count: 890, p50: 420, p90: 900 },
    queue: { count: 400, p50: 120, p90: 800 },
    byLanguage: [
      { language: 'cpp', count: 200, p50: 1500 },
      { language: 'python', count: 150, p50: 2100 },
      { language: 'constructor', count: 1, p50: null },
    ],
    verdicts: [
      { verdict: 'accepted', count: 250 },
      { verdict: 'wrong_answer', count: 100 },
      { verdict: 'time_limit', count: 50 },
    ],
    queuedNow: 2,
    runningNow: 1,
  },
  funnel: { visitors: 2345, problemBank: 1800, problem: 900, signedUp: 120, ran: 80, accepted: 40 },
  retention: [
    { day: '2026-10-10', users: 3, d1: null, d7: null },
    { day: '2026-10-09', users: 4, d1: 2, d7: null },
    { day: '2026-10-02', users: 5, d1: 1, d7: 2 },
  ],
  topViews: [
    { view: 'problems', type: null, count: 5000 },
    { view: 'content', type: 'experience', count: 1200 },
  ],
  topContent: [{ type: 'experience', slug: 'google-l4-onsite', count: 300 }],
  topSearches: [{ q: 'two sum', count: 42 }],
  errors: [{ stage: 'submit', status: 500, count: 3 }],
  locales: [
    { locale: 'en', count: 9000 },
    { locale: 'zh', count: 3345 },
  ],
});
const empty = (days) => ({
  range: { days, from: '2026-09-27', to: '2026-10-10' },
  generatedAt: Date.UTC(2026, 9, 10, 12, 5),
  totals: { pageViews: 0, visitors: 0, signups: 0, submissions: 0, runs: 0, accepted: 0, judgeErrors: 0 },
  daily: [],
  judge: {
    server: { count: 0, p50: null, p90: null, p99: null, avg: null },
    client: { count: 0, p50: null, p90: null, p99: null },
    run: { count: 0, p50: null, p90: null },
    queue: { count: 0, p50: null, p90: null },
    byLanguage: [],
    verdicts: [],
    queuedNow: 0,
    runningNow: 0,
  },
  topViews: [],
  topContent: [],
  topSearches: [],
  errors: [],
  locales: [],
});

test('owner metrics render the summary, refetch per range and handle empty and error states', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://cswork.test/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const calls = [];
  let failNext = false;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    const days = Number(new URL(url, 'https://cswork.test').searchParams.get('days'));
    if (failNext) {
      failNext = false;
      return { ok: false, status: 403, json: async () => ({ error: 'Owner only' }) };
    }
    return { ok: true, status: 200, json: async () => (days === 14 ? empty(days) : summary(days)) };
  };
  const { createRoot } = await import('react-dom/client');
  const { OwnerMetrics } = await import('../components/owner-metrics.tsx');
  const navigations = [];
  const root = createRoot(document.querySelector('#root'));
  const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));
  const text = () => document.body.textContent;
  const button = (label) => [...document.querySelectorAll('button')].find((b) => b.textContent === label);
  const click = (el) => {
    const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    el.dispatchEvent(event);
    return event;
  };
  try {
    await act(async () =>
      root.render(createElement(OwnerMetrics, { navigate: (view, extra) => navigations.push([view, extra]) })),
    );
    await settle();
    assert.equal(calls[0].url, '/api/metrics/summary?days=7');
    assert.equal(calls[0].init.headers['X-Locale'], 'en');
    assert.match(document.querySelector('h1').textContent, /Analytics/);
    assert.equal(button('7 days').getAttribute('aria-pressed'), 'true');
    assert.match(text(), /Updated \d/);

    // KPI strip
    const kpis = document.querySelector('.om-kpis').textContent;
    for (const s of ['Page views12,345', 'Visitors2,345', 'Signups67', 'Submissions400', '63% accepted · 890 runs'])
      assert.ok(kpis.includes(s), `KPI strip shows ${s}`);
    assert.ok(kpis.includes('Median judge time1.8 s'));
    assert.ok(kpis.includes('Users feel 2.4 s'));
    assert.ok(kpis.includes('Judging now3'));
    assert.ok(kpis.includes('2 queued · 1 running'));

    // Daily trend: two labelled small multiples, legend totals and the table twin.
    const plots = [...document.querySelectorAll('svg.om-plot')];
    assert.equal(plots.length, 2);
    assert.equal(plots[0].getAttribute('aria-label'), 'Daily page views and visitors, Oct 4 – Oct 10');
    assert.equal(plots[0].querySelectorAll('path.om-col').length, 7);
    assert.match(plots[1].textContent, /Oct 10/);
    assert.match(document.querySelector('.om-legend').textContent, /Page views 12,345/);
    assert.equal(document.querySelectorAll('.om-details tbody tr').length, 7);
    assert.match(document.querySelector('.om-details tbody tr').textContent, /Oct 10/);

    // Keyboard scrubbing drives the crosshair and the tooltip.
    const scrub = document.querySelector('input.om-scrub');
    await act(async () => scrub.focus());
    assert.match(document.querySelector('.om-tip').textContent, /Sat, Oct 10.*1,600Page views/);
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(scrub, '0');
      scrub.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    assert.match(document.querySelector('.om-tip').textContent, /Oct 4.*1,000Page views/);
    assert.match(scrub.getAttribute('aria-valuetext'), /^Oct 4: 1,000 page views, 200 visitors, 50 submissions, 30 accepted$/);
    assert.equal(document.querySelectorAll('.om-cross').length, 2);
    await act(async () => scrub.blur());
    assert.equal(document.querySelector('.om-tip'), null);

    // Judge latency: measured vs felt, percentiles, languages, verdicts.
    const card = (title) => [...document.querySelectorAll('.om-card')].find((c) => c.querySelector('h2').textContent === title);
    const latency = card('Judge latency');
    assert.match(latency.querySelector('.om-gap').textContent, /^\+600 ms/);
    for (const s of ['6.1 s', '8.3 s', '420 ms', '900 ms', '120 ms', '2.0 s'])
      assert.ok(latency.textContent.includes(s), `latency shows ${s}`);
    const languages = card('Judge time by language').querySelectorAll('tbody tr');
    assert.deepEqual(
      [...languages].map((tr) => tr.textContent),
      ['C++2001.5 s', 'Python1502.1 s', 'constructor1—'],
    );
    assert.match(text(), /ACAccepted250/);
    assert.match(text(), /WAWrong Answer100/);

    // Funnel: shares of all visitors; return by signup day, pooled over the cohorts that are due.
    const funnel = card('Funnel').textContent;
    for (const s of ['Visitors2,345100%', 'Viewed the problem bank1,80077%', 'Opened a problem90038%', 'First AC402%'])
      assert.ok(funnel.includes(s), `funnel shows ${s}`);
    const back = card('Return after signup');
    assert.equal(back.querySelector('.rd-badge').textContent, 'D1 33% · D7 40%');
    assert.deepEqual(
      [...back.querySelectorAll('tbody tr')].map((tr) => tr.textContent),
      ['Oct 103——', 'Oct 942 · 50%—', 'Oct 251 · 20%2 · 40%'],
    );

    // Top lists, errors and locales.
    assert.match(text(), /Problem Bank5,000/);
    assert.match(text(), /Content pageExperience1,200/);
    assert.match(text(), /two sum42/);
    assert.match(text(), /submit500/);
    assert.match(text(), /3 judge errors/);
    assert.match(text(), /English9,00073%/);
    assert.match(text(), /Chinese3,34527%/);
    const link = document.querySelector('a.om-link');
    assert.equal(link.getAttribute('href'), '/?view=content&type=experience&slug=google-l4-onsite');
    assert.equal(click(link).defaultPrevented, true);
    assert.deepEqual(navigations, [['content', { type: 'experience', slug: 'google-l4-onsite' }]]);

    // The range switch refetches; the old numbers stay up (faded) until the new ones land.
    await act(async () => click(button('30 days')));
    assert.equal(calls.at(-1).url, '/api/metrics/summary?days=30');
    await settle();
    assert.equal(button('30 days').getAttribute('aria-pressed'), 'true');
    assert.equal(button('7 days').getAttribute('aria-pressed'), 'false');
    assert.match(document.querySelector('.om-kpis').textContent, /54,321/);
    assert.match(document.querySelector('.om-kpis').textContent, /Median judge time2\.5 s/);
    assert.equal(document.querySelector('.om-grid.is-stale'), null);

    // Empty range.
    await act(async () => click(button('14 days')));
    await settle();
    assert.match(text(), /No visits or submissions in this range yet\./);
    assert.match(text(), /No judging in this range\./);
    assert.match(text(), /No searches yet\./);
    assert.equal(document.querySelector('.om-details'), null);

    // A failed request keeps the last numbers, says why and retries.
    failNext = true;
    await act(async () => click(button('90 days')));
    await settle();
    assert.match(document.querySelector('[role="alert"]').textContent, /Owner only/);
    assert.ok(document.querySelector('.om-grid.is-stale'));
    const before = calls.length;
    await act(async () => click(button('Retry')));
    await settle();
    assert.equal(calls.length, before + 1);
    assert.equal(calls.at(-1).url, '/api/metrics/summary?days=90');
    assert.equal(document.querySelector('[role="alert"]'), null);
    assert.match(document.querySelector('.om-kpis').textContent, /12,345/);
  } finally {
    await act(async () => root.unmount());
    delete globalThis.fetch;
  }
});
