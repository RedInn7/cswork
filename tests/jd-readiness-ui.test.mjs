// /career/jd: the checklist renders each skill's status, progress and practice link, and its
// gaps point at the problem bank. The (now unlinked) StudyPlan still reads planTopics from the URL.
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

test('the checklist: a handed-over posting, statuses, progress, practice links and the problem bank link', async () => {
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
  assert.deepEqual([...result.querySelectorAll('.jd-rounds a')].map((a) => a.getAttribute('href')), ['/mock-oa', '/categories/behavioral-leadership']);
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
  // Nothing measures front end here and nothing practises it, so no bar and no link.
  assert.equal(rows[2].querySelector('.jd-bar'), null);
  assert.equal(rows[2].querySelector('a'), null);
  assert.equal(result.querySelectorAll('h3')[1].textContent, 'Required');
  // The sprint plan is gone: the gaps now point at the problem bank.
  const plan = result.querySelector('.jd-plan-link');
  assert.equal(plan.getAttribute('href'), '/?view=problems');
  assert.match(plan.textContent, /^Go to the problem bank/);
  assert.match(result.querySelector('.jd-plan').textContent, /2 Line 500 stops have fewer than 3 solved problems: practise them in the problem bank\./);
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

// Keyword mode (AI off): the posting is read here; only skill ids go to the server, and the
// resume match runs on the builder's resume and versions in this browser.
const keywordPosting = `Software Engineer, New Grad
Minimum qualifications:
- Strong data structures and algorithms
- Python or Go; SQL and Postgres
Preferred qualifications:
- Kafka and distributed systems`;

test('keyword mode, signed out: the skills and rounds without progress, a sign-in link, nothing posted but ids', async () => {
  const sent = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.endsWith('/api/oj/ai/usage')) throw new Error('keyword mode never asks for AI usage');
    sent.push([u, JSON.parse(init.body)]);
    return Response.json({ error: '请先登录' }, { status: 401 });
  };
  localStorage.clear();
  sessionStorage.setItem(JD_HANDOFF_KEY, keywordPosting);
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(JdReadiness, { zh: false, ai: false })));
  await settle();
  assert.match(document.querySelector('.resume-actions small').textContent, /^Keyword matching, not AI/);
  await act(async () => button('Check my readiness').click());
  await settle();
  // Only the ids found: never a word of the posting.
  assert.deepEqual(sent, [['/api/oj/ai/jd', { skills: ['dsa', 'python', 'go', 'sql', 'system-design'] }]]);
  const result = document.querySelector('.resume-result');
  assert.match(result.querySelector('.jd-mode').textContent, /Keyword matching, not AI/);
  assert.equal(result.querySelector('.jd-mode a').getAttribute('href'), '/?view=account');
  assert.equal(result.querySelector('.resume-summary').textContent, 'This posting asks for 5 skills.');
  const rows = [...result.querySelectorAll('.jd-skill')];
  assert.equal(rows.length, 5);
  assert.equal(result.querySelectorAll('.jd-status, .jd-bar').length, 0, 'no verdict without progress');
  assert.equal(rows[0].querySelector('q').textContent, 'Strong data structures and algorithms');
  assert.deepEqual([...result.querySelectorAll('h3')].map((h) => h.textContent), ['Likely rounds', 'Required', 'Nice to have']);
  assert.equal(result.querySelector('.jd-plan'), null);
  // No resume in this browser: the match points to the builder.
  assert.equal(document.querySelector('.jd-match a').getAttribute('href'), '/career/resume/builder');
  // Known signed out: a second check posts nothing.
  await act(async () => button('Check my readiness').click());
  await settle();
  assert.equal(sent.length, 1);
  await act(async () => root.unmount());
});

test('keyword mode, signed in: progress merged by skill; the resume match per version, with where each term is', async () => {
  globalThis.fetch = async (url, init = {}) => {
    const { skills } = JSON.parse(init.body);
    return Response.json({
      skills: skills.map((skill) => ({ skill, status: skill === 'sql' ? 'ready' : 'gap', done: skill === 'sql' ? 30 : 0, total: 30, certified: false })),
      likelyRounds: [],
      planStops: ['binary-search'],
    });
  };
  localStorage.setItem(
    'cswork:resume:v1',
    JSON.stringify({
      experience: [{ title: 'Acme', bullets: 'Built a Python service on Postgres serving 2M users' }],
      skills: 'Languages: Python, SQL',
    }),
  );
  localStorage.setItem('cswork:resume:versions', JSON.stringify({ Backend: { projects: [{ title: 'Raft', bullets: 'Go and Kafka, data structures' }] } }));
  sessionStorage.setItem(JD_HANDOFF_KEY, keywordPosting);
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(JdReadiness, { zh: false, ai: false })));
  await settle();
  await act(async () => button('Check my readiness').click());
  await settle();
  const result = document.querySelector('.resume-result');
  assert.equal(result.querySelector('.jd-mode a'), null);
  assert.match(result.querySelector('.resume-summary').textContent, /^This posting asks for 5 skills: 1 ready/);
  const sql = [...result.querySelectorAll('.jd-skill')].find((r) => r.textContent.startsWith('SQL'));
  assert.deepEqual([sql.dataset.status, sql.querySelector('.jd-status').textContent], ['ready', 'Ready']);
  assert.equal(result.querySelector('.jd-plan-link').getAttribute('href'), '/?view=problems');
  // The base resume has Python, SQL and Postgres: 3 of the posting's 8 terms, all three required ones.
  const match = document.querySelector('.jd-match');
  assert.match(match.querySelector('.resume-summary').textContent, /^38% match: your resume has 3 of the posting’s 8 keywords \(3 of 6 required\)\./);
  const found = Object.fromEntries([...match.querySelectorAll('.jd-match-found li')].map((li) => [li.querySelector('strong').textContent, li.querySelector('small').textContent]));
  assert.deepEqual(found, { Python: 'Acme · Skills', SQL: 'Skills', PostgreSQL: 'Acme' });
  assert.deepEqual([...match.querySelectorAll('.is-missing li')].map((li) => li.textContent), [
    'Data structures',
    'Algorithms',
    'Go',
    'Distributed systems (nice to have)',
    'Kafka (nice to have)',
  ]);
  // The Backend version instead.
  const select = match.querySelector('select');
  await act(async () => {
    select.value = '1';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  assert.deepEqual([...match.querySelectorAll('.jd-match-found strong')].map((s) => s.textContent).sort(), ['Data structures', 'Go', 'Kafka']);
  await act(async () => root.unmount());
  localStorage.clear();
});
