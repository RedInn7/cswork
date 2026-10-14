import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Threads, answers and comments in the posts component; the discussion board; the profile,
// follower and list pages; the weekly board; members' company stats; experience fields and filters.
const react = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
const alert = `import React from ${JSON.stringify(react)};export const AlertDialog=({open,children})=>open?React.createElement('div',{role:'alertdialog'},children):null;export const AlertDialogContent=({children})=>React.createElement('div',null,children);export const AlertDialogDescription=AlertDialogContent;export const AlertDialogHeader=AlertDialogContent;export const AlertDialogFooter=AlertDialogContent;export const AlertDialogTitle=AlertDialogContent;export const AlertDialogAction=({children,onClick})=>React.createElement('button',{onClick},children);export const AlertDialogCancel=AlertDialogAction;`;
register(
  `data:text/javascript,${encodeURIComponent(`const alert=${JSON.stringify(alert)};export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};if(u.endsWith('/components/ui/alert-dialog.tsx'))return {format:'module',source:alert,shortCircuit:true};return n(u,c);}`)}`,
  import.meta.url,
);

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/?view=discuss' });
for (const name of [
  'window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent',
  'FocusEvent', 'getComputedStyle', 'localStorage', 'sessionStorage', 'navigator', 'location',
])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] ?? dom.window.MouseEvent });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame ??= (cb) => setTimeout(cb, 0);
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
const { createRoot } = await import('react-dom/client');
const { SolutionPosts } = await import('../components/solution-posts.tsx');
const { DiscussBoard } = await import('../components/discuss-board.tsx');
const { FollowBoard } = await import('../components/follow-board.tsx');
const { MemberStatsCard } = await import('../components/company-stats-card.tsx');
const { MyExperienceSubmissions } = await import('../components/experience-submissions.tsx');
const { ContentList } = await import('../components/content-library.tsx');
const { ProfileView, PublicListView, FollowListView } = await import('../app/u/views.tsx');

const wait = (ms = 5) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
const $ = (selector) => document.querySelector(selector);
const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(text));
function set(element, value) {
  const proto = { TEXTAREA: dom.window.HTMLTextAreaElement, SELECT: dom.window.HTMLSelectElement }[element.tagName] ?? dom.window.HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(element, value);
  element.dispatchEvent(new dom.window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
}
let root = null;
async function mount(element) {
  if (root) await act(async () => root.unmount());
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(element));
  await wait();
}
/** fetch stub: `answer(key, body)` gives JSON (or undefined for a 404); every call is recorded. */
function stub(answer) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const key = `${init.method || 'GET'} ${String(url).replace('/api/', '')}`;
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ key, body });
    const value = answer(key, body);
    return new Response(JSON.stringify(value ?? { error: 'missing' }), { status: value === 401 ? 401 : value ? 200 : 404 });
  };
  return { calls, restore: () => (globalThis.fetch = original) };
}
const thread = {
  id: '11111111-1111-4111-8111-111111111111',
  problemId: 'discuss:career',
  title: 'Referral timelines',
  language: '',
  tag: 'amazon',
  hidden: 0,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  author: 'Ad***',
  mine: false,
  votes: 4,
  voted: false,
  comments: 2,
  excerpt: 'How long did yours take?',
};
const companies = { items: [{ slug: 'amazon', name: 'Amazon' }, { slug: 'uber', name: 'Uber' }] };

test('threads: a channel lists without a lock, signed out writing asks to sign in, signed in it posts a company tag', async () => {
  const { calls, restore } = stub((key) => {
    if (key.startsWith('GET oj/posts?')) return { solved: true, items: [thread], more: false };
    if (key === 'GET oj/reports/companies') return companies;
    if (key === 'POST oj/posts') return { post: { ...thread, id: '22222222-2222-4222-8222-222222222222', mine: true, body: 'x' }, comments: [] };
    if (key.startsWith('GET oj/posts/')) return { post: { ...thread, body: 'Body' }, comments: [] };
  });
  const asked = [];
  window.addEventListener('cswork:auth-required', () => asked.push(1));
  try {
    await mount(createElement(SolutionPosts, { problemId: 'discuss:career', english: true, signedIn: false }));
    assert.equal($('.cs-posts-locked') === null, true, 'threads are never locked');
    assert.equal($('.cs-post-row-title').textContent, 'Referral timelines');
    assert.equal($('.cs-post-tag').textContent, 'Amazon', 'the company tag shows by name');
    assert.equal($('.cs-posts-filter') === null, true, 'no technique filter on threads');
    await act(async () => button('New thread').click());
    assert.equal(asked.length, 1, 'signed out, writing asks to sign in');
    assert.equal($('.cs-post-editor') === null, true);

    await mount(createElement(SolutionPosts, { problemId: 'discuss:career', english: true, tag: 'uber', signedIn: true }));
    assert.equal(calls.some((c) => c.key === 'GET oj/posts?problem=discuss%3Acareer&tag=uber&sort=votes'), true, 'filtered by company');
    await act(async () => button('New thread').click());
    const editor = $('.cs-post-editor');
    assert.equal(editor.querySelector('input') !== null, true, 'threads have a title');
    const selects = [...editor.querySelectorAll('select')];
    assert.equal(selects.length, 1, 'a company menu, no language');
    assert.equal(selects[0].value, 'uber', 'the board’s company is the default');
    assert.equal(editor.querySelector('textarea').value, '', 'no solution outline');
    await act(async () => {
      set(editor.querySelector('input'), 'Uber team match?');
      set(editor.querySelector('textarea'), 'How long did it take?');
    });
    await act(async () => editor.requestSubmit());
    await wait();
    const sent = calls.find((c) => c.key === 'POST oj/posts').body;
    assert.deepEqual(sent, { title: 'Uber team match?', body: 'How long did it take?', language: '', tag: 'uber', problemId: 'discuss:career' });
  } finally {
    restore();
  }
});

test('answers and comments: no title of their own; solutions filter and tag by technique', async () => {
  const { calls, restore } = stub((key) => {
    if (key.startsWith('GET oj/posts?problem=q')) return { solved: true, items: [{ ...thread, problemId: 'q:tell-me', title: 'Situation first', tag: '' }], more: false };
    if (key.startsWith('GET oj/posts?problem=lc-1')) return { solved: true, items: [], more: false };
    if (key === 'POST oj/posts') return { post: { ...thread, problemId: 'q:tell-me', body: 'x', mine: true }, comments: [] };
    if (key.startsWith('GET oj/posts/')) return { post: { ...thread, problemId: 'q:tell-me', body: 'Body' }, comments: [] };
  });
  try {
    await mount(createElement(SolutionPosts, { problemId: 'q:tell-me', english: false, signedIn: true }));
    assert.equal($('.cs-post-row-title') === null, true, 'an answer reads by its excerpt');
    assert.equal(button('写我的回答') !== undefined, true);
    await act(async () => button('写我的回答').click());
    assert.equal($('.cs-post-editor input') === null, true, 'no title field');
    assert.equal($('.cs-post-editor select') === null, true, 'no language or tag');
    await act(async () => set($('.cs-post-editor textarea'), 'Situation: a launch slipped.'));
    await act(async () => $('.cs-post-editor').requestSubmit());
    await wait();
    assert.deepEqual(calls.find((c) => c.key === 'POST oj/posts').body, {
      title: '', body: 'Situation: a launch slipped.', language: '', tag: '', problemId: 'q:tell-me',
    });

    await mount(createElement(SolutionPosts, { problemId: 'lc-1', english: true }));
    await act(async () => set($('.cs-posts-filter select'), 'binary-search'));
    await wait();
    assert.equal(calls.some((c) => c.key === 'GET oj/posts?problem=lc-1&tag=binary-search&sort=votes'), true);
    await act(async () => button('Write a solution').click());
    const technique = [...$('.cs-post-editor').querySelectorAll('select')].find((s) => s.querySelector('option[value="binary-search"]'));
    assert.equal(technique !== undefined, true, 'a technique menu in the solution editor');
  } finally {
    restore();
  }
});

test('the board switches channels and companies through the URL and opens a linked thread', async () => {
  const { restore } = stub((key) => {
    if (key.startsWith('GET oj/posts?')) return { solved: true, items: [thread], more: false };
    if (key === 'GET oj/reports/companies') return companies;
    if (key.startsWith('GET oj/posts/')) return { post: { ...thread, body: '**Hi**' }, comments: [{ id: 'c1', body: 'Two weeks', createdAt: 1, author: 'G***', mine: false }] };
  });
  const navigations = [];
  try {
    await mount(createElement(DiscussBoard, { params: { channel: 'career' }, navigate: (...a) => navigations.push(a), signedIn: true }));
    const pressed = [...document.querySelectorAll('.discuss-channels button')].filter((b) => b.getAttribute('aria-pressed') === 'true');
    assert.deepEqual(pressed.map((b) => b.querySelector('strong').textContent), ['Careers']);
    await act(async () => button('Algorithms').click());
    assert.deepEqual(navigations.at(-1), ['discuss', { channel: 'algo' }]);
    await act(async () => set($('.discuss-filter select'), 'amazon'));
    assert.deepEqual(navigations.at(-1), ['discuss', { channel: 'career', company: 'amazon' }]);
    assert.equal($('a.discuss-board-public').getAttribute('href'), '/discuss?channel=career');

    await mount(createElement(DiscussBoard, { params: { channel: 'career', post: thread.id }, navigate: () => {}, signedIn: true }));
    assert.equal($('.cs-post-title').textContent, 'Referral timelines', 'the linked thread opens first');
    assert.equal($('.cs-comment-body').textContent, 'Two weeks');
    assert.equal($(`a[href="/discuss/${thread.id}"]`) !== null, true, 'with its public link');
  } finally {
    restore();
  }
});

test('the profile shows languages, badges, posts, follows and list saves; follower pages list handles', () => {
  const catalogue = new Map([['lc-1', { id: 'lc-1', title: '两数之和', titleEn: 'Two Sum', difficulty: '简单', tags: [] }]]);
  const profile = {
    handle: 'line-rider',
    bio: '',
    indexable: false,
    solved: { total: 1, easy: 1, medium: 0, hard: 0 },
    stops: [],
    activity: [],
    recent: [],
    lists: [{ id: 'AbCdEfGhIjKl', title: 'Warm-up', count: 3, stars: 2 }],
    listStars: 2,
    languages: [{ language: 'python', n: 3 }, { language: 'cpp', n: 1 }],
    badges: [{ id: 'streak:7', group: 'streak', zh: '连续 7 天', en: '7-day streak' }],
    posts: { items: [{ id: thread.id, target: 'discuss:algo', title: 'Monotonic stack', votes: 3, createdAt: 1 }, { id: 'p2', target: 'lc-1', title: 'Hash map', votes: 1, createdAt: 1 }], total: 2, votes: 4 },
    followers: 5,
    following: 1,
  };
  const doc = new JSDOM(renderToStaticMarkup(createElement(ProfileView, { profile, catalogue, zh: false }))).window.document;
  assert.deepEqual([...doc.querySelectorAll('.learner-langs li span:first-child')].map((s) => s.textContent), ['Python', 'C++']);
  assert.equal(doc.querySelector('.learner-badges li').textContent, '7-day streak');
  assert.equal(doc.querySelector('a[href="/u/line-rider/followers"]').textContent, '5 followers');
  assert.equal(doc.querySelector(`a[href="/discuss/${thread.id}"]`) !== null, true, 'threads link to their page');
  assert.equal(doc.querySelector('a[href="/?view=problem&problem=lc-1"]') !== null, true, 'solutions link to the problem');
  assert.equal(doc.querySelector('#learner-posts').textContent.includes('4 upvotes'), true);
  assert.equal(doc.querySelector('a[href="/u/lists/AbCdEfGhIjKl"]').textContent.includes('2 saves'), true);
  assert.equal(
    [...doc.querySelectorAll('section[aria-labelledby]')].every((s) => doc.getElementById(s.getAttribute('aria-labelledby')) !== null),
    true,
  );
  // An older payload without the new fields still renders.
  const { languages: _l, badges: _b, posts: _p, followers: _f, ...old } = profile;
  assert.equal(renderToStaticMarkup(createElement(ProfileView, { profile: old, catalogue, zh: true })).includes('@line-rider'), true);

  const people = { handle: 'line-rider', items: [{ handle: 'ada', bio: 'graphs' }], followers: 1, followees: 0 };
  const list = new JSDOM(renderToStaticMarkup(createElement(FollowListView, { people, which: 'followers', zh: true }))).window.document;
  assert.equal(list.querySelector('a[href="/u/ada"]').textContent.includes('@ada'), true);
  assert.equal(list.querySelector('a[aria-current="page"]').getAttribute('href'), '/u/line-rider/followers');

  const page = new JSDOM(
    renderToStaticMarkup(
      createElement(PublicListView, {
        list: { id: 'AbCdEfGhIjKl', title: 'Warm-up', description: '', visibility: 'public', owner: null, mine: false, items: [], stars: 2, forks: 1 },
        items: [],
        zh: false,
      }),
    ),
  ).window.document;
  assert.equal(page.querySelector('.list-star').textContent.includes('2 saves'), true);
  assert.equal(page.querySelector('.list-star').textContent.includes('1 copy'), true);
  assert.equal(page.querySelector('.list-star button[aria-pressed="false"]') !== null, true);
});

test('the weekly board ranks me among the people I follow', async () => {
  const { calls, restore } = stub((key) =>
    key.startsWith('GET oj/follows/board')
      ? { following: 2, since: 1, items: [{ handle: 'grace', n: 4, me: false }, { handle: null, n: 2, me: true }, { handle: 'linus', n: 0, me: false }] }
      : undefined,
  );
  try {
    await mount(createElement(FollowBoard, { english: true }));
    assert.equal(calls[0].key.startsWith('GET oj/follows/board?tz='), true, 'the local week');
    const rows = [...document.querySelectorAll('.follow-board-rows li')];
    assert.deepEqual(rows.map((r) => r.querySelector('b').textContent), ['4', '2', '0']);
    assert.equal(rows[1].hasAttribute('data-me'), true);
    assert.equal(rows[1].querySelector('a') === null, true, 'my own row is not a link');
    assert.equal(rows[0].querySelector('a').getAttribute('href'), '/u/grace');
  } finally {
    restore();
  }
  const empty = stub(() => ({ following: 0, since: 1, items: [{ handle: null, n: 0, me: true }] }));
  try {
    await mount(createElement(FollowBoard, { english: false }));
    assert.equal($('.follow-board-rows') === null, true);
    assert.equal($('.cloud-starred-empty').textContent.includes('关注'), true);
  } finally {
    empty.restore();
  }
});

test('members’ company stats show only the figures the server sent', () => {
  const html = (stats) => new JSDOM(renderToStaticMarkup(createElement(MemberStatsCard, { stats, locale: 'en' }))).window.document;
  const full = html({
    posts: 6,
    difficulty: { n: 5, average: 3.4 },
    sentiment: { n: 6, rows: [{ value: 'pos', n: 4 }, { value: 'neg', n: 2 }] },
    channel: { n: 5, rows: [{ value: 'referral', n: 5 }] },
    weeks: { n: 5, median: 4 },
  });
  assert.equal(full.querySelector('.company-stats-figures').textContent.includes('3.4'), true);
  assert.equal(full.querySelector('.company-stats-legend li').textContent.startsWith('Positive 67%'), true);
  assert.equal(full.querySelector('.company-stats-bars').textContent.includes('Referral'), true);
  const thin = html({ posts: 5, difficulty: null, sentiment: null, channel: null, weeks: { n: 5, median: 2.5 } });
  assert.equal(thin.querySelectorAll('.company-stats-panel').length, 0);
  assert.equal(thin.querySelector('.company-stats-figures').textContent.includes('2.5 weeks'), true);
});

test('the experience form sends the optional facts; the list offers member-only filters with a note', async () => {
  const { calls, restore } = stub((key, body) => {
    if (key === 'GET oj/experiences/mine') return { items: [] };
    if (key === 'GET oj/reports/companies') return companies;
    if (key === 'POST oj/experiences') return { member: { id: 'BBBBBBBBBBBB' }, slug: 'member.BBBBBBBBBBBB', title: body.title, company: companies.items[0] };
    if (key.startsWith('GET content/list'))
      return {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        facets: { companies: [], companyTotal: 0, roles: [], categories: [], difficulties: [], rounds: [], results: [{ value: 'Offer', label: 'Offer', n: 3 }], total: 0 },
        memberFacets: { employment: [{ value: 'intern', label: 'intern', n: 2 }], season: [{ value: '2026-fall', label: '2026-fall', n: 1 }], channel: [] },
        memberOnly: key.includes('employment='),
      };
  });
  try {
    await mount(createElement(MyExperienceSubmissions, { english: true, navigate: () => {}, open: true }));
    const form = $('form.xs-form');
    const details = form.querySelector('.xs-details');
    const [employment, season, channel, difficulty, sentiment] = details.querySelectorAll('select');
    await act(async () => {
      set(form.querySelector('select'), 'amazon');
      set(form.querySelector('input[list]'), 'SDE Intern');
      set(form.querySelector('input[minlength="4"]'), 'Amazon intern loop');
      set(form.querySelectorAll('textarea')[0], 'Coding, design and behavioral rounds. '.repeat(4));
      set(employment, 'intern');
      set(season, season.querySelectorAll('option')[2].value);
      set(channel, 'referral');
      set(difficulty, '4');
      set(sentiment, 'pos');
      set(details.querySelector('input[type="number"]'), '6');
      set(details.querySelector('input[maxlength="80"]'), ' Seattle ');
      [...form.querySelectorAll('.xs-chip')].find((l) => l.textContent === 'Onsite').querySelector('input').click();
      form.querySelector('.xs-agree input').click();
    });
    await act(async () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
    await wait();
    const sent = calls.find((c) => c.key === 'POST oj/experiences').body;
    assert.equal(sent.employment, 'intern');
    assert.equal(/^\d{4}-(spring|summer|fall|winter)$/.test(sent.season), true);
    assert.deepEqual([sent.channel, sent.difficulty, sent.sentiment, sent.durationWeeks, sent.location], ['referral', 4, 'pos', 6, 'Seattle']);
    assert.equal('weeks' in sent, false, 'only the server’s field names');

    const navigations = [];
    await mount(createElement(ContentList, { section: 'experiences', params: {}, navigate: (...a) => navigations.push(a) }));
    const menu = [...document.querySelectorAll('.ct-facets select')].find((s) => s.querySelector('option[value="intern"]'));
    assert.equal(menu.querySelector('option[value="intern"]').textContent.startsWith('Internship'), true, 'labelled, not raw');
    assert.equal(menu.querySelector('option').textContent.includes("members' posts"), true);
    const seasons = [...document.querySelectorAll('.ct-facets select')].find((s) => s.querySelector('option[value="2026-fall"]'));
    assert.equal(seasons.querySelector('option[value="2026-fall"]').textContent.startsWith('2026 Fall'), true);
    await act(async () => set(menu, 'intern'));
    assert.deepEqual(navigations.at(-1), ['experiences', { type: 'experience', employment: 'intern' }]);
    assert.equal($('a[href="/?view=discuss&channel=offer"]') !== null, true, 'offer stories beside "Offers only"');
    assert.equal($('.ct-member-note') === null, true);
    await mount(createElement(ContentList, { section: 'experiences', params: { employment: 'intern' }, navigate: () => {} }));
    assert.equal($('.ct-member-note') !== null, true, 'says only member posts show');
  } finally {
    restore();
  }
});
