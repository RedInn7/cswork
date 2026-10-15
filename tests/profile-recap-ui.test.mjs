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

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/u/ann' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'navigator', 'location', 'localStorage', 'sessionStorage'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { yearRecap } = await import('../lib/year-recap.ts');
const { ProfileView, RecapView, CompareView } = await import('../app/u/views.tsx');
const { ProfileHeatmap } = await import('../app/u/heatmap.tsx');
const { PublicProfileSettings } = await import('../components/public-profile-settings.tsx');
const { YearRecapCard } = await import('../components/year-recap-card.tsx');

const wait = () => act(async () => new Promise((r) => setTimeout(r, 5)));
async function mount(element) {
  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(element));
  await wait();
  return root;
}
const html = (element) => new JSDOM(renderToStaticMarkup(element)).window.document;
const at = (m, d, h = 10) => new Date(2026, m, d, h).getTime();
function type(input, value) {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
}

test('a year grid runs Monday to Sunday over the local year, with its busiest day and best streak', () => {
  const activity = [
    { problem_id: '0', created_at: at(0, 5) },
    { problem_id: '1', created_at: at(0, 6) },
    { problem_id: '2', created_at: at(0, 6, 20) },
    { problem_id: '0', created_at: at(0, 7) },
    { problem_id: '3', created_at: at(2, 1) },
    // The server pads its UTC year: local days of the neighbouring years are left out.
    { problem_id: '9', created_at: new Date(2025, 11, 31, 23).getTime() },
    { problem_id: '9', created_at: new Date(2027, 0, 1, 1).getTime() },
  ];
  const recap = yearRecap(activity, 2026, at(5, 1), true);
  // 1 Jan 2026 is a Thursday: three blank cells first, 365 days, 53 weeks.
  assert.equal(recap.weeks, 53);
  assert.deepEqual(recap.cells.slice(0, 4).map((c) => c && new Date(c.time).getDate()), [null, null, null, 1]);
  assert.equal(recap.cells.filter(Boolean).length, 365);
  assert.equal(recap.total, 4, 'distinct problems in the year');
  assert.equal(recap.activeDays, 4);
  assert.equal(recap.best, 3, '5–7 January');
  assert.deepEqual([new Date(recap.busiest.time).getDate(), recap.busiest.count], [6, 2]);
  assert.equal(recap.cells.find((c) => c && c.future && new Date(c.time).getMonth() === 4), undefined, 'May is past');
  assert.ok(recap.cells.find((c) => c && new Date(c.time).getMonth() === 5 && new Date(c.time).getDate() === 2).future);
  assert.deepEqual(recap.months.map((m) => m.label).slice(0, 3), ['Jan', 'Feb', 'Mar']);
  assert.equal(recap.months[0].column, 0);
  // A leap year starting on a Sunday reaches into a 54th week.
  assert.equal(yearRecap([], 2012, 0, true).weeks, 54);
  assert.equal(yearRecap([], 2012, 0, true).cells.filter(Boolean).length, 366);
});

test('the year heatmap fills in after mount with the year’s summary', async () => {
  const activity = [
    { problem_id: '0', created_at: at(0, 5) },
    { problem_id: '1', created_at: at(0, 6) },
  ];
  // The server sends the layout only: blank cells, no summary.
  const server = html(createElement(ProfileHeatmap, { activity, zh: false, year: 2026 }));
  assert.equal(server.querySelectorAll('.learner-heatmap-grid span').length, 53 * 7);
  assert.equal(server.querySelectorAll('.learner-heatmap-grid [data-out]').length, 53 * 7 - 365);
  assert.equal(server.querySelector('.learner-heatmap small'), null);
  assert.equal(server.querySelector('.learner-heatmap').getAttribute('data-year'), '2026');
  const root = await mount(createElement(ProfileHeatmap, { activity, zh: false, year: 2026 }));
  assert.match(document.querySelector('.learner-heatmap small').textContent, /^2 solved in 2026 · best streak 2 days · busiest day Jan 5 \(1\)$/);
  assert.equal(document.querySelectorAll('.learner-heatmap-grid [data-level="1"]').length, 2);
  await act(async () => root.unmount());
});

const catalogue = new Map([['lc-1', { id: 'lc-1', title: '两数之和', titleEn: 'Two Sum', difficulty: '简单', tags: [] }]]);
const profile = {
  handle: 'ann',
  bio: '',
  indexable: false,
  solved: { total: 1, easy: 1, medium: 0, hard: 0 },
  stops: [],
  activity: [],
  years: [2026, 2025],
  recent: [],
  lists: [],
  links: [
    { kind: 'github', url: 'https://github.com/ann' },
    { kind: 'website', url: 'https://www.ann.example.com/' },
  ],
  school: 'MIT',
  gradYear: 2027,
  targetRole: 'Backend SWE',
};

test('the profile card shows links as nofollow ugc in a new tab, school, class and role, and the years', () => {
  const doc = html(createElement(ProfileView, { profile, catalogue, zh: false }));
  const links = [...doc.querySelectorAll('.learner-links a')];
  assert.deepEqual(
    links.map((a) => [a.getAttribute('href'), a.getAttribute('rel'), a.getAttribute('target')]),
    [
      ['https://github.com/ann', 'nofollow ugc noopener', '_blank'],
      ['https://www.ann.example.com/', 'nofollow ugc noopener', '_blank'],
    ],
  );
  assert.equal(links[1].firstChild.textContent, 'ann.example.com');
  assert.equal(doc.querySelector('.learner-facts').textContent, 'MIT · Class of 2027 · Aiming for Backend SWE');
  assert.deepEqual(
    [...doc.querySelectorAll('.learner-years a')].map((a) => [a.getAttribute('href'), a.getAttribute('aria-current')]),
    [
      ['/u/ann', 'page'],
      ['/u/ann?year=2026', null],
      ['/u/ann?year=2025', null],
    ],
  );
  assert.equal(doc.querySelector('a[href^="/u/compare"]'), null, 'signed out: no compare link');
  assert.equal(doc.querySelectorAll('.learner-heatmap-grid span').length, 26 * 7);
  // ?year=2025: that year's grid and a link to its recap.
  const year = html(
    createElement(ProfileView, { profile, catalogue, zh: true, year: { year: 2025, activity: [] }, viewer: 'bob' }),
  );
  assert.equal(year.querySelector('.learner-years a[aria-current="page"]').textContent, '2025');
  assert.ok(year.querySelector('a[href="/u/ann/recap/2025"]'));
  assert.equal(year.querySelector('.learner-heatmap').getAttribute('data-year'), '2025');
  assert.equal(year.querySelector('a[href="/u/compare?a=bob&b=ann"]').textContent, '和我对比');
  const own = html(createElement(ProfileView, { profile, catalogue, zh: true, viewer: 'ann' }));
  assert.equal(own.querySelector('a[href^="/u/compare"]'), null, 'not with yourself');
});

test('the recap and compare pages show counts only', () => {
  const recap = {
    handle: 'ann',
    indexable: false,
    year: 2026,
    years: [2026, 2025],
    activity: [],
    solved: { total: 3, easy: 0, medium: 2, hard: 1 },
    stops: [{ slug: 'two-pointers-windows', solved: 2, total: 20 }],
    contest: { contests: 2, start: 1520, end: 1540 },
  };
  const doc = html(createElement(RecapView, { recap, zh: false }));
  assert.equal(doc.querySelector('h1').textContent, '@ann in 2026');
  assert.equal(doc.querySelector('.learner-total dd').textContent, '3');
  assert.equal(doc.querySelector('.learner-recap-contest').textContent, '2 rated contests, rating 1520 → 1540');
  assert.equal(doc.querySelectorAll('.learner-stops li').length, 1);
  assert.deepEqual(
    [...doc.querySelectorAll('.learner-years a')].map((a) => a.getAttribute('href')),
    ['/u/ann/recap/2026', '/u/ann/recap/2025'],
  );
  assert.ok([...doc.querySelectorAll('section[aria-labelledby]')].every((s) => doc.getElementById(s.getAttribute('aria-labelledby'))));

  const compare = {
    people: [
      { handle: 'ann', solved: { total: 4, easy: 1, medium: 2, hard: 1 }, stops: { 'hash-counting': 1 } },
      { handle: 'bob', solved: { total: 3, easy: 2, medium: 1, hard: 0 }, stops: { 'hash-counting': 1, 'stacks-heaps': 1 } },
    ],
    common: 2,
    stops: [
      { slug: 'hash-counting', total: 12 },
      { slug: 'stacks-heaps', total: 15 },
    ],
  };
  const cmp = html(createElement(CompareView, { compare, zh: false }));
  assert.equal(cmp.querySelector('h1').textContent, '@ann vs @bob');
  assert.equal(cmp.querySelector('.learner-compare-common').textContent, 'Solved by both: 2');
  // The nowrap board scrolls inside its own keyboard-reachable region, never the page on a phone.
  const wrap = cmp.querySelector('.contest-board-wrap[role="region"][tabindex="0"]');
  assert.ok(wrap?.querySelector('table.learner-compare'));
  assert.equal(wrap.getAttribute('aria-label'), 'Solved by difficulty');
  assert.deepEqual(
    [...cmp.querySelectorAll('.learner-compare tbody tr')].map((tr) => [...tr.children].map((c) => c.textContent)),
    [
      ['Solved', '4', '3'],
      ['Easy', '1', '2'],
      ['Medium', '2', '1'],
      ['Hard', '1', '0'],
    ],
  );
  assert.deepEqual(
    [...cmp.querySelectorAll('.learner-compare-stops > li')].map((li) => [...li.querySelectorAll('b')].map((b) => b.textContent)),
    [
      ['1/12', '1/12'],
      ['0/15', '1/15'],
    ],
  );
  assert.ok(cmp.querySelector('a[href="/u/bob"]'));
});

test('the settings card saves links, school, class year and role, and says the school board needs contests shown', async () => {
  const posts = [];
  const original = globalThis.fetch;
  const saved = { handle: 'ann', visible: true, indexable: false, showContest: true, bio: '', featuredBadge: null };
  globalThis.fetch = async (url, init = {}) => {
    if (!init.body) return Response.json({ profile: saved, badges: [] });
    const body = JSON.parse(init.body);
    posts.push(body);
    return Response.json({ profile: body, badges: [] });
  };
  try {
    const root = await mount(createElement(PublicProfileSettings));
    // A profile saved before these fields existed loads with them empty.
    assert.equal(document.querySelector('input[autocomplete="organization"]').value, '');
    assert.match(document.body.textContent, /school board, together with showing contests and a contest rating/);
    const input = (label) => document.getElementById([...document.querySelectorAll('label')].find((l) => l.textContent === label).htmlFor);
    await act(async () => type(input('School (optional)'), 'MIT'));
    await act(async () => type(input('Graduation year (optional)'), '2027'));
    await act(async () => type(input('Target role (optional)'), 'Backend SWE'));
    await act(async () => type(input('GitHub'), 'https://github.com/ann'));
    await act(async () => type(input('Website'), 'https://ann.example.com'));
    await act(async () => document.querySelector('form.cloud-profile-form').requestSubmit());
    await wait();
    const sent = posts.at(-1);
    assert.deepEqual(
      [sent.school, sent.gradYear, sent.targetRole, sent.links],
      [
        'MIT',
        2027,
        'Backend SWE',
        [
          { kind: 'website', url: 'https://ann.example.com' },
          { kind: 'github', url: 'https://github.com/ann' },
        ],
      ],
    );
    // Clearing a link drops it.
    await act(async () => type(input('GitHub'), ''));
    await act(async () => document.querySelector('form.cloud-profile-form').requestSubmit());
    await wait();
    assert.deepEqual(posts.at(-1).links, [{ kind: 'website', url: 'https://ann.example.com' }]);
    await act(async () => root.unmount());
  } finally {
    globalThis.fetch = original;
  }
});

test('my year recap card sums the loaded history, per year, and links the public recap', async () => {
  const item = (problemId, acAt, stop = null) => ({
    problemId,
    attempts: 1,
    firstAt: acAt[0] ?? 0,
    lastAt: acAt.at(-1) ?? 0,
    firstAcAt: acAt[0] ?? null,
    failuresBeforeAc: 0,
    lastStatus: 'accepted',
    languages: ['python'],
    acAt,
    stop,
  });
  const history = [
    item('lc-1', [at(0, 5), at(0, 6)], 'hash-counting'),
    item('lc-3', [at(0, 6, 20)], 'two-pointers-windows'),
    item('oa-x-1', [new Date(2025, 3, 1, 10).getTime()]),
    item('lc-9', []),
  ];
  const root = await mount(createElement(YearRecapCard, { history, english: true, handle: 'ann', now: at(5, 1) }));
  assert.equal(document.querySelector('#year-recap-title').textContent, '2026 in review');
  const meters = () => [...document.querySelectorAll('.year-recap-meters dd')].map((d) => d.textContent);
  assert.deepEqual(meters(), ['2', '2', '2 days', 'Jan 6 · 2']);
  assert.match(document.querySelector('.year-recap-stops').textContent, /\(1\)/);
  assert.equal(document.querySelector('.year-recap a').getAttribute('href'), '/u/ann/recap/2026');
  const select = document.querySelector('.year-recap select');
  await act(async () => {
    select.value = '2025';
    select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  assert.deepEqual(meters(), ['1', '1', '1 day', 'Apr 1 · 1']);
  assert.equal(document.querySelector('.year-recap-stops'), null);
  assert.equal(document.querySelector('.year-recap a').getAttribute('href'), '/u/ann/recap/2025');
  await act(async () => root.unmount());
  const none = await mount(createElement(YearRecapCard, { history: [item('lc-9', [])], english: false, handle: null, now: at(5, 1) }));
  assert.equal(document.querySelector('.year-recap'), null, 'nothing solved yet: no card');
  await act(async () => none.unmount());
});
