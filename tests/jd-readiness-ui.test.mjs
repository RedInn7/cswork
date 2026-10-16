// /career/jd: the checklist renders each skill's status, progress and practice link, and its
// gaps reach the Line 500 sprint plan through the URL, which opens the form with them ticked.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { register } from 'node:module';

register(
  `data:text/javascript,${encodeURIComponent(
    "export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'export default {}',shortCircuit:true};return n(u,c);}",
  )}`,
  import.meta.url,
);

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/career/jd' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { JdReadiness } = await import('../components/jd-readiness.tsx');
const { StudyPlan } = await import('../components/study-plan.tsx');
const { DEFAULT_GOAL } = await import('../lib/study-plan.ts');
const { JD_HANDOFF_KEY } = await import('../lib/jd-skills.ts');
const { ROUTE_SLUGS } = await import('../lib/route-stops.ts');

const settle = (ms = 10) => act(async () => new Promise((r) => setTimeout(r, ms)));
const button = (label) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
const posting = 'New grad software engineer. Requirements: data structures and algorithms, Python, SQL. Nice: React.';
const reply = {
  skills: [
    { skill: 'dsa', evidence: 'data structures and algorithms', importance: 'must', status: 'partial', done: 12, total: 35 },
    { skill: 'sql', evidence: 'SQL', importance: 'must', status: 'ready', done: 4, total: 30, certified: true },
    { skill: 'frontend', evidence: 'React', importance: 'nice', status: 'unmeasured', done: 0, total: 0, certified: false },
  ],
  likelyRounds: ['oa', 'behavioral'],
  planStops: ['binary-search', 'dp-grid'],
  remaining: 2,
  limit: 3,
  bonus: 0,
};

test('the checklist: a handed-over posting, statuses, progress, practice links and the plan link', async () => {
  const sent = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.endsWith('/api/oj/ai/usage')) return Response.json({ jd: 3, bonus: 0 });
    if (u.endsWith('/api/oj/ai/jd')) {
      sent.push(JSON.parse(init.body));
      return Response.json(reply);
    }
    throw new Error(`unexpected ${u}`);
  };
  sessionStorage.setItem(JD_HANDOFF_KEY, posting);
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(JdReadiness, { zh: false })));
  await settle();
  assert.equal(document.getElementById('jd-text').value, posting, 'the resume review handed the posting over');
  assert.equal(sessionStorage.getItem(JD_HANDOFF_KEY), null, 'and it is not kept');
  assert.equal(document.querySelector('.resume-actions small').textContent, '3 checks left today');
  await act(async () => button('Check my readiness').click());
  await settle();
  assert.deepEqual(sent, [{ job: posting }]);
  const result = document.querySelector('.resume-result');
  assert.equal(document.activeElement, result, 'the checklist takes focus');
  // Front end is not measured here: neither counted as a gap nor left out of the total.
  assert.equal(result.querySelector('.resume-summary').textContent, 'This posting asks for 3 skills: 1 ready, 1 in progress, 0 gaps, 1 not measured here.');
  assert.deepEqual([...result.querySelectorAll('.jd-rounds a')].map((a) => a.getAttribute('href')), ['/mock-oa', '/?view=mock-interview&template=behavioral']);
  const rows = [...result.querySelectorAll('.jd-skill')];
  assert.deepEqual(rows.map((r) => [r.dataset.status, r.querySelector('.jd-status').textContent]), [
    ['partial', 'In progress'],
    ['ready', 'Ready'],
    ['unmeasured', 'Not measured'],
  ]);
  assert.equal(rows[0].querySelector('.jd-bar i').style.width, '34%');
  assert.match(rows[0].textContent, /12 \/ 35 stops with 3 solved/);
  assert.equal(rows[0].querySelector('q').textContent, 'data structures and algorithms');
  assert.equal(rows[0].querySelector('a').getAttribute('href'), '/?view=problems');
  // The certificate makes SQL ready; the count shown is still the real one.
  assert.match(rows[1].textContent, /4 \/ 30 problems solved \(certificate earned\)/);
  // Nothing measures front end here, so no bar; the AI mock interview's front-end round is its practice.
  assert.equal(rows[2].querySelector('.jd-bar'), null);
  assert.equal(rows[2].querySelector('a').getAttribute('href'), '/?view=mock-interview&template=frontend');
  assert.equal(result.querySelectorAll('h3')[1].textContent, 'Required');
  const plan = result.querySelector('.jd-plan-link');
  assert.equal(new URL(plan.href).searchParams.get('planTopics'), 'binary-search,dp-grid');
  assert.equal(document.querySelector('.resume-actions small').textContent, '2 checks left today');
  await act(async () => root.unmount());
});

test('the study plan opens its form with the handed-over stops as topics, and drops the parameter', async () => {
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/api/oj/mock-oa/presets')) return Response.json({ companies: [] });
    throw new Error(`unexpected ${url}`);
  };
  history.replaceState(null, '', '/?view=problems&planTopics=dp-grid,bogus,binary-search');
  const saved = [];
  const root = createRoot(document.getElementById('root'));
  const goal = { ...DEFAULT_GOAL, startStop: 9 };
  const stops = ROUTE_SLUGS.map((slug, index) => ({ slug, index, code: String(index + 1).padStart(2, '0'), shortZh: slug, shortEn: slug, total: 10, solved: 0 }));
  await act(async () =>
    root.render(createElement(StudyPlan, { goal, plan: null, today: '2026-10-15', onSave: (g) => saved.push(g), stops, english: true })),
  );
  await settle();
  assert.equal(location.search, '?view=problems', 'a reload does not reopen it');
  assert.equal(document.querySelector('.route-plan-topics').open, true);
  const ticked = [...document.querySelectorAll('.route-plan-topics input:checked')].map((i) => i.parentElement.textContent);
  assert.equal(ticked.length, 2);
  await act(async () => button('Save plan').click());
  await settle();
  // In line order; the plan starts no later than the first handed-over stop (binary-search is stop 6).
  assert.deepEqual(saved.map((g) => [g.status, g.topics, g.startStop]), [['planned', ['binary-search', 'dp-grid'], 5]]);
  await act(async () => root.unmount());
});
