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

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/?view=lists' });
for (const name of [
  'window',
  'document',
  'HTMLElement',
  'Element',
  'Node',
  'Event',
  'MouseEvent',
  'PointerEvent',
  'KeyboardEvent',
  'FocusEvent',
  'getComputedStyle',
  'localStorage',
  'sessionStorage',
  'navigator',
  'location',
])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] ?? dom.window.MouseEvent });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame ??= (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
const { createRoot } = await import('react-dom/client');
const { mergeMockHistory, unsyncedMocks } = await import('../lib/mock-cloud.ts');
const { ProfileView, PublicListView } = await import('../app/u/views.tsx');
const { MyLists } = await import('../components/my-lists.tsx');
const { AskedReport, communityProblem } = await import('../components/problem-community.tsx');
const { PublicProfileSettings } = await import('../components/public-profile-settings.tsx');

const wait = (ms = 5) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(text));
function type(input, value) {
  const proto = input.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement : dom.window.HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
}
async function mount(element) {
  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(element));
  await wait();
  return root;
}

const session = (id, startedAt, result) => ({
  id,
  company: 'amazon',
  name: 'Amazon',
  platform: 'HackerRank',
  preset: true,
  scoring: 'tests',
  source: 'mixed',
  slots: ['easy'],
  ids: ['lc-1'],
  minutes: 60,
  skew: 0,
  createdAt: startedAt,
  startedAt,
  finishedAt: startedAt + 1000,
  ...(result ? { result } : {}),
});

test('local and account mock histories merge newest first, the server score winning', () => {
  const local = { active: null, history: [session('a', 30, { score: 99, max: 100, solved: 1, estimate: false }), session('b', 10)] };
  const remote = [session('a', 30, { score: 50, max: 100, solved: 0, estimate: false }), session('c', 20)];
  const merged = mergeMockHistory(local, remote);
  assert.deepEqual(merged.history.map((s) => s.id), ['a', 'c', 'b']);
  assert.equal(merged.history[0].result.score, 50);
  // Unscored on the server, or missing there, means upload again.
  assert.deepEqual(unsyncedMocks(local.history, remote).map((s) => s.id), ['b']);
  assert.deepEqual(unsyncedMocks([{ ...session('d', 1), finishedAt: undefined }], []), [], 'running mocks stay local');
});

test('the profile and public list pages render without names, with links and a heatmap', () => {
  const catalogue = new Map([
    ['lc-1', { id: 'lc-1', title: '两数之和', titleEn: 'Two Sum', difficulty: '简单', tags: [] }],
    ['oa-amazon-1', { id: 'oa-amazon-1', title: '仓库', titleEn: 'Warehouse', difficulty: '中等', tags: [] }],
  ]);
  const profile = {
    handle: 'line-rider',
    bio: 'grinding',
    indexable: false,
    solved: { total: 2, easy: 1, medium: 1, hard: 0 },
    stops: [{ slug: 'hash-counting', solved: 1, total: 12 }],
    activity: [{ problem_id: 'lc-1', created_at: Date.now() }],
    recent: [
      { id: 'lc-1', at: Date.now() },
      { id: 'oa-amazon-1', at: Date.now() - 1000 },
    ],
    lists: [{ id: 'AbCdEfGhIjKl', title: 'Warm-up', count: 3 }],
  };
  for (const zh of [true, false]) {
    const doc = new JSDOM(renderToStaticMarkup(createElement(ProfileView, { profile, catalogue, zh }))).window.document;
    assert.equal(doc.querySelector('h1').textContent, '@line-rider');
    assert.equal(doc.querySelectorAll('h1').length, 1);
    assert.equal(doc.querySelector('.learner-total dd').textContent, '2');
    assert.equal(doc.querySelectorAll('.learner-rows li').length, 2);
    assert.ok(doc.querySelector('.learner-rows a').getAttribute('href') === '/?view=problem&problem=lc-1');
    assert.ok(doc.querySelector('a[href="/u/lists/AbCdEfGhIjKl"]') !== null);
    assert.ok(doc.querySelector('a[href="/?view=problems&section=hash-counting"]') !== null);
    // The grid fills in after mount (the reader's time zone); the server sends empty cells.
    assert.equal(doc.querySelectorAll('.learner-heatmap-grid span').length, 26 * 7);
    // Recent dates too: the server's UTC day could disagree with the reader's heatmap.
    assert.ok([...doc.querySelectorAll('.learner-rows time')].every((t) => t.textContent === ''));
    assert.ok(
      [...doc.querySelectorAll('section[aria-labelledby]')].every((s) => doc.getElementById(s.getAttribute('aria-labelledby')) !== null),
    );
    assert.equal(doc.querySelector('.learner-featured'), null, 'no featured badge chosen');
  }
  const featured = { id: 'domain:line', group: 'domain', zh: '算法 2 星', en: 'Algorithms · 2 stars' };
  const chip = new JSDOM(
    renderToStaticMarkup(createElement(ProfileView, { profile: { ...profile, featured }, catalogue, zh: false })),
  ).window.document.querySelector('.learner-featured');
  assert.equal(chip.textContent, '★Featured badge: Algorithms · 2 stars');
  assert.equal(chip.getAttribute('data-group'), 'domain');
  const langs = new JSDOM(
    renderToStaticMarkup(
      createElement(ProfileView, { profile: { ...profile, languages: [{ language: 'pandas', n: 2 }, { language: 'sql', n: 1 }] }, catalogue, zh: false }),
    ),
  ).window.document;
  assert.deepEqual([...langs.querySelectorAll('.learner-langs li > span:first-child')].map((s) => s.textContent), ['Pandas', 'SQL']);
  const list = {
    id: 'AbCdEfGhIjKl',
    title: 'Warm-up',
    description: 'Before the onsite',
    visibility: 'public',
    owner: null,
    mine: false,
    items: [],
  };
  const items = [{ id: 'lc-1', problem: catalogue.get('lc-1') }];
  const doc = new JSDOM(renderToStaticMarkup(createElement(PublicListView, { list, items, zh: false }))).window.document;
  assert.equal(doc.querySelector('h1').textContent, 'Warm-up');
  assert.ok(doc.querySelector('.lists-public-kicker').textContent === 'Learner list', 'no owner handle, no name');
  assert.equal(doc.querySelectorAll('.lists-public-rows li').length, 1);
  assert.ok(doc.querySelector('.lists-public-cta').getAttribute('href').startsWith('/?view=lists&list=AbCdEfGhIjKl'));
  const owned = new JSDOM(
    renderToStaticMarkup(createElement(PublicListView, { list: { ...list, owner: 'line-rider' }, items, zh: true })),
  ).window.document;
  assert.ok(owned.querySelector('a[href="/u/line-rider"]') !== null);
});

test('my lists: create one, open it, remove a problem as the owner, copy someone else’s', async () => {
  const posts = [];
  const navigations = [];
  const navigate = (view, extra) => navigations.push([view, extra]);
  let detail = {
    id: 'AbCdEfGhIjKl',
    title: 'Warm-up',
    description: '',
    visibility: 'public',
    forkedFrom: null,
    count: 2,
    updatedAt: Date.now(),
    items: [
      { problemId: 'lc-1', addedAt: 1 },
      { problemId: 'oa-amazon-1', addedAt: 2 },
    ],
    mine: true,
    owner: null,
  };
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const path = String(url).replace('/api/', '');
    const body = init.body ? JSON.parse(init.body) : undefined;
    if (body) posts.push([path, body]);
    if (path === 'oj/lists' && !body) return Response.json({ items: [{ ...detail, items: undefined }] });
    if (path === 'oj/lists') return Response.json({ ...detail, id: 'NewListId123', title: body.title }, { status: 201 });
    if (path === `oj/lists/${detail.id}`) return Response.json(detail);
    if (path === 'oj/history')
      return Response.json({ items: [{ problemId: 'lc-1', firstAcAt: 1, attempts: 1, lastStatus: 'accepted' }] });
    if (path === `oj/lists/${detail.id}/items`) {
      detail = { ...detail, items: detail.items.filter((i) => i.problemId !== body.problemId) };
      return Response.json(detail);
    }
    if (path === `oj/lists/${detail.id}/fork`) return Response.json({ ...detail, id: 'ForkedList12', mine: true });
    throw new Error(`unexpected ${path}`);
  };
  const boot = {
    person: { id: 'u1' },
    problems: [
      { id: 'lc-1', title: '两数之和', titleEn: 'Two Sum', difficulty: '简单', tags: [] },
      { id: 'oa-amazon-1', title: '仓库', titleEn: 'Warehouse', difficulty: '中等', tags: [] },
    ],
  };
  try {
    let root = await mount(createElement(MyLists, { boot, navigate }));
    assert.equal(document.querySelector('h1').textContent, 'My lists');
    assert.ok(document.querySelector('a[href="/?view=lists&list=AbCdEfGhIjKl"]').textContent.includes('Warm-up'));
    await act(async () => type(document.querySelector('input[aria-label="List name"]'), 'Before the onsite'));
    await act(async () => button('New list').click());
    await wait();
    assert.deepEqual(posts.at(-1), ['oj/lists', { title: 'Before the onsite', problemIds: [] }]);
    assert.deepEqual(navigations.at(-1), ['lists', { list: 'NewListId123' }]);
    await act(async () => root.unmount());

    root = await mount(createElement(MyLists, { boot, navigate, list: detail.id }));
    assert.equal(document.querySelector('h1').textContent, 'Warm-up');
    assert.ok(document.querySelector('.cloud-meter').getAttribute('aria-label') === '1 of 2 solved');
    assert.ok(document.querySelector('.cloud-meter').getAttribute('role') === 'img', 'the label is announced');
    assert.ok(document.querySelector('.cloud-share input').value.endsWith('/u/lists/AbCdEfGhIjKl'));
    assert.equal(document.querySelectorAll('.cloud-item').length, 2);
    await act(async () => document.querySelector('button[aria-label="Remove Two Sum from the list"]').click());
    await wait();
    assert.deepEqual(posts.at(-1), [`oj/lists/${detail.id}/items`, { problemId: 'lc-1', on: false }]);
    assert.equal(document.querySelectorAll('.cloud-item').length, 1);
    assert.ok(!button('Copy to my lists'), 'owners do not fork their own list');
    await act(async () => root.unmount());

    detail = { ...detail, mine: false, owner: 'line-rider' };
    root = await mount(createElement(MyLists, { boot, navigate, list: detail.id }));
    assert.equal(document.querySelectorAll('.cloud-remove').length, 0);
    assert.ok(!document.querySelector('.cloud-share'));
    assert.ok(document.querySelector('.route-kicker').textContent.includes('@line-rider'));
    await act(async () => button('Copy to my lists').click());
    await wait();
    assert.deepEqual(navigations.at(-1), ['lists', { list: 'ForkedList12' }]);
    await act(async () => root.unmount());
  } finally {
    globalThis.fetch = original;
  }
});

test('"I was asked this" shows the recent count and sends a month, company and round', async () => {
  const posts = [];
  let summary = { problemId: 'oa-amazon-1', months: 6, total: 3, last: '2026-09', companies: [{ slug: 'amazon', name: 'Amazon', n: 2 }], mine: [] };
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const path = String(url).replace('/api/', '');
    if (path === 'oj/reports?problem=oa-amazon-1') return Response.json(summary);
    if (path === 'oj/reports/companies') return Response.json({ items: [{ slug: 'amazon', name: 'Amazon' }, { slug: 'meta', name: 'Meta' }] });
    if (path === 'oj/reports') {
      const body = JSON.parse(init.body);
      posts.push(body);
      summary = { ...summary, total: 4, mine: [{ month: body.month, company: body.company, round: body.round }] };
      return Response.json(summary);
    }
    throw new Error(`unexpected ${path}`);
  };
  try {
    const root = await mount(createElement(AskedReport, { problemId: 'oa-amazon-1', english: true }));
    const trigger = document.querySelector('.cs-asked');
    assert.ok(trigger.getAttribute('aria-label') === 'I was asked this (Asked 3× lately)');
    assert.equal(trigger.textContent, '3');
    await act(async () => trigger.click());
    await wait(20);
    assert.ok(document.body.textContent.includes('3 learners reported it in the last 6 months, latest 2026-09.'));
    const select = document.querySelector('.cloud-asked-form select');
    assert.equal(select.value, 'amazon', 'an OA problem preselects its company');
    await act(async () => document.querySelector('input[type="radio"][value="onsite"]').click());
    await act(async () => button('Report').click());
    await wait();
    assert.equal(posts.length, 1);
    assert.equal(posts[0].problemId, 'oa-amazon-1');
    assert.equal(posts[0].company, 'amazon');
    assert.equal(posts[0].round, 'onsite');
    assert.match(posts[0].month, /^\d{4}-\d{2}$/);
    assert.ok(document.body.textContent.includes("Thanks, it's recorded."));
    assert.ok(document.querySelector('.cs-asked').textContent === '4');
    await act(async () => root.unmount());
  } finally {
    globalThis.fetch = original;
  }
});

test('signed out, the asked badge still counts and a click asks to sign in; course exercises get neither', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const path = String(url).replace('/api/', '');
    if (path === 'oj/reports?problem=lc-1')
      return Response.json({ problemId: 'lc-1', months: 6, total: 2, last: '2026-10', companies: [], mine: [] });
    throw new Error(`unexpected ${path}`);
  };
  let asked = 0;
  const onAuth = () => asked++;
  window.addEventListener('cswork:auth-required', onAuth);
  try {
    const root = await mount(createElement(AskedReport, { problemId: 'lc-1', english: false, signedIn: false }));
    const trigger = document.querySelector('.cs-asked');
    assert.ok(trigger.getAttribute('aria-label') === '我面试被问到过（最近被问 2 次）');
    await act(async () => trigger.click());
    assert.equal(asked, 1);
    assert.ok(!document.querySelector('.cloud-asked-form'), 'no form until signed in');
    await act(async () => root.unmount());
  } finally {
    window.removeEventListener('cswork:auth-required', onAuth);
    globalThis.fetch = original;
  }
  assert.ok(communityProblem('lc-1') && communityProblem('oa-amazon-1'));
  assert.ok(!communityProblem('watch-intervals') && !communityProblem('lc-1x'));
});

test('the public profile card is off until switched on and saves a lowercase handle', async () => {
  const posts = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const path = String(url).replace('/api/', '');
    if (path !== 'oj/profile') throw new Error(`unexpected ${path}`);
    if (!init.body) return Response.json({ profile: null, badges: [] });
    const body = JSON.parse(init.body);
    posts.push(body);
    return Response.json({ profile: body, badges: [{ id: 'daily:2026-02', zh: '2026 年 2 月每日一题全勤', en: 'Daily problem every day, Feb 2026' }] });
  };
  try {
    const root = await mount(createElement(PublicProfileSettings));
    // No page yet: no badges and no picker.
    assert.equal(document.querySelector('select'), null);
    const [visible, indexable, showContest, showPractice] = document.querySelectorAll('.cloud-check input');
    assert.equal(visible.checked, false);
    assert.equal(indexable.disabled, true, 'search indexing needs a public page first');
    assert.equal(showContest.disabled, true, 'so does the contest rating');
    assert.equal(showPractice.disabled, true, 'and the practice leaderboard');
    assert.equal(document.querySelector('.cloud-profile-badge'), null, 'no badge before the page is public');
    await act(async () => type(document.querySelector('.cloud-handle input'), 'Line-Rider'));
    await act(async () => visible.click());
    await act(async () => document.querySelector('form.cloud-profile-form').requestSubmit());
    await wait();
    assert.deepEqual(posts, [
      {
        handle: 'line-rider',
        visible: true,
        indexable: false,
        showContest: false,
        showPractice: false,
        bio: '',
        featuredBadge: null,
        links: [],
        school: '',
        gradYear: null,
        targetRole: '',
      },
    ]);
    assert.ok(document.querySelector('a[href="/u/line-rider"]') !== null);
    assert.equal(
      document.querySelector('.cloud-profile-badge input').value,
      '[![CSWork @line-rider](https://cswork.org/u/line-rider/badge.svg?lang=en)](https://cswork.org/u/line-rider)',
    );
    // The first save brings the earned badges, so the picker shows without a reload.
    assert.deepEqual([...document.querySelector('select').options].map((o) => o.value), ['', 'daily:2026-02']);
    await act(async () => root.unmount());
  } finally {
    globalThis.fetch = original;
  }
});

test('the profile card features one earned badge, and a contest one only with the curve shown', async () => {
  const posts = [];
  const original = globalThis.fetch;
  // Featuring a badge given up since: the form lets it go rather than have the save refused.
  const saved = { handle: 'line-rider', visible: true, indexable: false, showContest: true, bio: '', featuredBadge: 'list:blind-75' };
  const badges = [
    { id: 'daily:2026-02', zh: '2026 年 2 月每日一题全勤', en: 'Daily problem every day, Feb 2026' },
    { id: 'contest:first', zh: '首次发车', en: 'First departure' },
  ];
  globalThis.fetch = async (url, init = {}) => {
    if (!init.body) return Response.json({ profile: saved, badges });
    const body = JSON.parse(init.body);
    posts.push(body);
    return Response.json({ profile: body, badges });
  };
  try {
    const root = await mount(createElement(PublicProfileSettings));
    const select = document.querySelector('select');
    assert.deepEqual([...select.options].map((o) => o.value), ['', 'daily:2026-02', 'contest:first']);
    assert.equal(select.value, '');
    const choose = (value) =>
      act(async () => {
        select.value = value;
        select.dispatchEvent(new window.Event('change', { bubbles: true }));
      });
    await choose('daily:2026-02');
    await act(async () => document.querySelector('form.cloud-profile-form').requestSubmit());
    await wait();
    assert.equal(posts.at(-1).featuredBadge, 'daily:2026-02');
    // Hiding the contest curve takes a featured contest badge down with it.
    await choose('contest:first');
    const showContest = document.querySelectorAll('.cloud-check input')[2];
    await act(async () => showContest.click());
    await act(async () => document.querySelector('form.cloud-profile-form').requestSubmit());
    await wait();
    assert.deepEqual([posts.at(-1).showContest, posts.at(-1).featuredBadge], [false, null]);
    await act(async () => root.unmount());
  } finally {
    globalThis.fetch = original;
  }
});

test('my lists: the owner previews a paste, adds it in bulk and reorders by button and by drag', async () => {
  const posts = [];
  let detail = {
    id: 'AbCdEfGhIjKl',
    title: 'Warm-up',
    description: '',
    visibility: 'private',
    forkedFrom: null,
    count: 2,
    updatedAt: Date.now(),
    items: [
      { problemId: 'lc-1', addedAt: 1 },
      { problemId: 'oa-amazon-1', addedAt: 2 },
    ],
    mine: true,
    owner: null,
  };
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const path = String(url).replace('/api/', '');
    const body = init.body ? JSON.parse(init.body) : undefined;
    if (body) posts.push([path, body]);
    if (path === `oj/lists/${detail.id}`) return Response.json(detail);
    if (path === 'oj/history') return Response.json({ items: [] });
    if (path === `oj/lists/${detail.id}/bulk`) {
      detail = { ...detail, items: [...detail.items, { problemId: 'lc-3', addedAt: 3 }] };
      return Response.json({ added: 1, duplicate: 1, unknown: ['what?'], overflow: 0, list: detail });
    }
    if (path === `oj/lists/${detail.id}/reorder`) return Response.json(detail);
    throw new Error(`unexpected ${path}`);
  };
  const boot = {
    person: { id: 'u1' },
    problems: [
      { id: 'lc-1', title: '两数之和', titleEn: 'Two Sum', difficulty: '简单', tags: [] },
      { id: 'lc-3', title: '无重复字符的最长子串', titleEn: 'Longest Substring', difficulty: '中等', tags: [] },
      { id: 'oa-amazon-1', title: '仓库', titleEn: 'Warehouse', difficulty: '中等', tags: [] },
    ],
  };
  const order = () => [...document.querySelectorAll('.cloud-item a')].map((a) => new URL(a.href).searchParams.get('problem'));
  try {
    const root = await mount(createElement(MyLists, { boot, navigate: () => {}, list: detail.id }));
    const box = document.querySelector('.cloud-import');
    assert.equal(box.open, false, 'folded when the list already has problems');
    assert.ok(button('Add to the list').disabled, 'nothing to add yet');
    await act(async () =>
      type(box.querySelector('textarea'), 'https://leetcode.cn/problems/p-3/\n\n1\nwhat?\n'),
    );
    assert.equal(
      box.querySelector('.cloud-import-note').textContent,
      '3 lines: numbers 1 · LeetCode links or slugs 1 · site problems 0 · not recognized 1',
    );
    assert.deepEqual([...box.querySelectorAll('.cloud-import-lines li')].map((li) => li.textContent), ['what?']);
    await act(async () => button('Add to the list').click());
    await wait();
    assert.deepEqual(posts.at(-1), [
      `oj/lists/${detail.id}/bulk`,
      { lines: ['https://leetcode.cn/problems/p-3/', '1', 'what?'] },
    ]);
    assert.equal(
      box.querySelector('output').textContent,
      'Added 1 problem; 1 already in the list or repeated; 1 line found no problem a list can hold (lists take OA and LeetCode problems) and went back in the box.',
    );
    assert.deepEqual([...box.querySelectorAll(':scope > ul li')].map((li) => li.textContent), ['what?']);
    assert.equal(box.querySelector('textarea').value, 'what?', 'left to fix and add again');
    assert.deepEqual(order(), ['lc-1', 'oa-amazon-1', 'lc-3']);

    assert.ok(document.querySelector('button[aria-label="Move Two Sum up"]').disabled);
    const sent = posts.length;
    await act(async () => document.querySelector('button[aria-label="Move Two Sum down"]').click());
    await wait();
    assert.deepEqual(order(), ['oa-amazon-1', 'lc-1', 'lc-3']);
    assert.equal(document.activeElement.id, 'list-move-down-lc-1', 'focus stays on the moved row');
    assert.equal(document.querySelector('[aria-live="polite"]').textContent, 'Two Sum moved to position 2');
    // Moved to the bottom, its down button turns off and focus goes to up.
    await act(async () => document.activeElement.click());
    await wait();
    assert.equal(document.activeElement.id, 'list-move-up-lc-1');
    assert.equal(posts.length, sent, 'quick button moves wait for a pause');
    await wait(650);
    assert.deepEqual(posts.slice(sent), [[`oj/lists/${detail.id}/reorder`, { problemIds: ['oa-amazon-1', 'lc-3', 'lc-1'] }]]);

    const drag = (type, target) => {
      const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', { value: { setData() {}, effectAllowed: '', dropEffect: '' } });
      target.dispatchEvent(event);
    };
    const rows = () => [...document.querySelectorAll('.cloud-item')];
    assert.equal(rows()[0].getAttribute('draggable'), 'true');
    await act(async () => drag('dragstart', rows()[2]));
    await act(async () => drag('dragover', rows()[0]));
    assert.equal(rows()[0].dataset.drop, 'before');
    await act(async () => drag('drop', rows()[0]));
    await wait();
    assert.deepEqual(posts.at(-1), [`oj/lists/${detail.id}/reorder`, { problemIds: ['lc-1', 'oa-amazon-1', 'lc-3'] }]);
    assert.deepEqual(order(), ['lc-1', 'oa-amazon-1', 'lc-3']);
    assert.equal(rows()[0].dataset.drop, undefined);
    await act(async () => root.unmount());

    // Someone else's list: no paste box, no order controls, nothing draggable.
    detail = { ...detail, mine: false, visibility: 'public' };
    const theirs = await mount(createElement(MyLists, { boot, navigate: () => {}, list: detail.id }));
    assert.equal(document.querySelector('.cloud-import'), null);
    assert.equal(document.querySelectorAll('.cloud-move').length, 0);
    assert.equal(rows()[0].getAttribute('draggable'), 'false');
    await act(async () => theirs.unmount());
  } finally {
    globalThis.fetch = original;
  }
});
