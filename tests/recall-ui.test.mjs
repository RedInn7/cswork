// Self-graded review: the rating card under a revealed answer and the queue on My progress.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

// CSS is a no-op; next/link (aliased by the bundler) is a stub.
register(
  `data:text/javascript,${encodeURIComponent(
    "export async function resolve(s,c,n){if(s==='next/link')return {url:'data:text/javascript,export default function Link(){return null}',shortCircuit:true};return n(s,c);}" +
      "export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}",
  )}`,
  import.meta.url,
);

const NOTE = '/api/oj/notes?target=recall%3Aqueue';
const T = 'content:interview_question/lru';
const settle = () => act(async () => new Promise((r) => setTimeout(r, 10)));
const today = Math.floor(Date.now() / 86_400_000);

function useDom() {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/?view=content' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'navigator', 'location'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.localStorage.setItem('cswork:locale', 'en'); // English UI copy below; the site defaults to zh.
  globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  return dom;
}
/** The note API for one signed-in learner (`saved` is the note body), or 401 when `saved` is null. */
function noteApi(state) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push([init.method ?? 'GET', String(url)]);
    assert.equal(String(url), NOTE);
    if (state.saved === null) return Response.json({ error: 'Sign in first' }, { status: 401 });
    if (state.failGet && !init.method) return Response.json({ error: 'Too many requests' }, { status: 429 });
    if (init.method === 'PUT') {
      if (state.failPut) return Response.json({ error: 'Too many requests' }, { status: 429 });
      state.saved = JSON.parse(init.body).body;
      return Response.json({ target: 'recall:queue', body: state.saved, updatedAt: 1 });
    }
    return Response.json({ target: 'recall:queue', body: state.saved, updatedAt: null });
  };
  return calls;
}
const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
const status = () => document.querySelector('.recall-status').textContent;

test('a guest ticks key points and grades an answer; knowing it again before it is due changes nothing', async () => {
  const dom = useDom();
  const { createRoot } = await import('react-dom/client');
  const { RecallRate } = await import('../components/recall-rate.tsx');
  const original = globalThis.fetch;
  const calls = noteApi({ saved: null });
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () =>
      root.render(createElement(RecallRate, { target: T, title: 'LRU cache', points: ['Hash map', 'Linked list'], signedIn: false })),
    );
    await settle();
    assert.equal(calls.length, 0, 'a guest never asks the account');
    assert.ok(document.querySelector('.recall-note').textContent.includes('Kept on this device'));
    assert.equal(document.querySelector('.recall-points legend').textContent, 'Key points you covered (0 of 2)');
    await act(async () => document.querySelector('.recall-points input').click());
    assert.equal(document.querySelector('.recall-points legend').textContent, 'Key points you covered (1 of 2)');
    assert.equal(document.querySelector('fieldset.recall-grades legend').textContent, 'How well did you know it?');

    await act(async () => button('Knew it').click());
    await settle();
    assert.deepEqual(JSON.parse(localStorage.getItem('cswork:recall:v1')), { v: 1, items: { [T]: [1, today, 'LRU cache'] } });
    assert.match(status(), /^Saved\. It comes back on /);
    assert.equal(document.querySelector('.recall-status a'), null, 'no queue link for a guest');

    await act(async () => button('Knew it').click());
    await settle();
    assert.match(status(), /^Not due until .+, so it stays in its box\./);
    await act(async () => button("Didn't know").click());
    await settle();
    assert.deepEqual(JSON.parse(localStorage.getItem('cswork:recall:v1')).items[T], [0, today, 'LRU cache']);

    // Another question starts fresh, and a reload shows the card's place in the queue.
    await act(async () => root.render(createElement(RecallRate, { key: 'sd', target: 'sd:url-shortener', title: 'URL shortener', signedIn: false })));
    await settle();
    assert.equal(document.querySelector('.recall-points'), null, 'a chapter has no key points');
    assert.equal(status(), '');
    await act(async () => root.render(createElement(RecallRate, { key: 'lru', target: T, title: 'LRU cache', signedIn: false })));
    await settle();
    assert.match(status(), /^In your review queue, back on /);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = original;
    dom.window.close();
  }
});

test("signed in, this device's cards move to the account once and each grade reads the latest note first", async () => {
  const dom = useDom();
  const { createRoot } = await import('react-dom/client');
  const { RecallRate } = await import('../components/recall-rate.tsx');
  const original = globalThis.fetch;
  localStorage.setItem('cswork:recall:v1', JSON.stringify({ v: 1, items: { 'sd:chat': [0, today - 3, 'Chat'], [T]: [0, today, 'old'] } }));
  const state = { saved: JSON.stringify({ v: 1, items: { [T]: [2, today - 1, 'LRU cache'] } }) };
  const calls = noteApi(state);
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(createElement(RecallRate, { target: T, title: 'LRU cache', signedIn: true })));
    await settle();
    assert.deepEqual(calls, [['GET', NOTE], ['PUT', NOTE]]);
    assert.deepEqual(JSON.parse(state.saved).items, { [T]: [2, today - 1, 'LRU cache'], 'sd:chat': [0, today - 3, 'Chat'] }, 'the account copy wins');
    assert.equal(localStorage.getItem('cswork:recall:v1'), null);
    assert.match(status(), /^In your review queue, back on /);
    assert.equal(document.querySelector('.recall-status a').getAttribute('href'), '/?view=progress&tab=review');

    // Another tab graded a chapter meanwhile: the grade keeps it.
    state.saved = JSON.stringify({ v: 1, items: { ...JSON.parse(state.saved).items, 'sd:feed': [1, today, 'Feed'] } });
    calls.length = 0;
    await act(async () => button('Partly').click());
    await settle();
    assert.deepEqual(calls, [['GET', NOTE], ['PUT', NOTE]]);
    assert.deepEqual(JSON.parse(state.saved).items[T], [2, today, 'LRU cache']);
    assert.ok('sd:feed' in JSON.parse(state.saved).items);

    state.failPut = true;
    await act(async () => button("Didn't know").click());
    await settle();
    assert.equal(status().trim(), "Couldn't save. Try again in a moment.");

    // The account can't be read: the grade fails instead of landing in this browser, where the
    // account's copy would win at the next load (and the next person to sign in would get it).
    state.failPut = false;
    state.failGet = true;
    await act(async () => button('Knew it').click());
    await settle();
    assert.equal(status().trim(), "Couldn't save. Try again in a moment.");
    assert.equal(localStorage.getItem('cswork:recall:v1'), null);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = original;
    dom.window.close();
  }
});

test('the queue lists cards due today with links, counts its boxes and clears mastered cards', async () => {
  const dom = useDom();
  const { createRoot } = await import('react-dom/client');
  const { RecallQueue, useRecallQueue } = await import('../components/recall-queue.tsx');
  const original = globalThis.fetch;
  const state = {
    saved: JSON.stringify({
      v: 1,
      items: {
        [T]: [1, today - 5, 'LRU cache'],
        'sd:url-shortener': [0, today - 1, 'URL shortener'],
        'content:coding_question/two-sum': [2, today, 'Two Sum'],
        'sd:chat': [4, today - 40, 'Chat'],
      },
    }),
  };
  noteApi(state);
  const navigations = [];
  let due = -1;
  function Host({ signedIn }) {
    const recall = useRecallQueue(signedIn);
    due = recall.due;
    return createElement(RecallQueue, { recall, signedIn, navigate: (...a) => navigations.push(a), english: true });
  }
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(createElement(Host, { signedIn: true })));
    await settle();
    assert.equal(due, 2);
    const rows = [...document.querySelectorAll('.recall-queue .progress-row')];
    assert.deepEqual(
      rows.map((a) => [a.querySelector('strong').textContent, a.getAttribute('href')]),
      [
        ['LRU cache', '/?view=content&type=interview_question&slug=lru'],
        ['URL shortener', '/system-design/url-shortener'],
      ],
    );
    assert.equal(rows[0].querySelector('.progress-detail').textContent, 'Review 2 of 4 · 2 days overdue');
    assert.equal(rows[1].querySelector('.progress-detail').textContent, 'Review 1 of 4 · Due today');
    assert.equal(
      document.querySelector('.recall-queue .cloud-head p').textContent,
      '1-day box 1 · 3-day box 1 · 7-day box 1 · 21-day box 0 · Mastered 1',
    );
    await act(async () => rows[0].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })));
    assert.deepEqual(navigations, [['content', { type: 'interview_question', slug: 'lru' }]]);

    await act(async () => button('Clear mastered (1)').click());
    await settle();
    assert.ok(!('sd:chat' in JSON.parse(state.saved).items));
    assert.equal(button('Clear mastered (1)'), undefined);

    // No cards: nothing shows.
    state.saved = '';
    await act(async () => root.render(createElement('div')));
    await act(async () => root.render(createElement(Host, { signedIn: true })));
    await settle();
    assert.equal(document.querySelector('.recall-queue'), null);
    assert.equal(due, 0);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = original;
    dom.window.close();
  }
});

test('the review session link counts due cards: new ones, due graded ones and due ideas, not deleted cards', async () => {
  const dom = useDom();
  const { createRoot } = await import('react-dom/client');
  const { ReviewSessionLink } = await import('../components/recall-queue.tsx');
  const original = globalThis.fetch;
  const id = (c) => `card:${c.repeat(12)}`;
  let cards = [id('a'), id('b'), id('c')];
  const notes = {
    'recall:cards': { v: 1, items: { [id('b')]: [0, today - 1, ''], [id('c')]: [2, today, ''], [id('d')]: [0, today - 1, ''] } },
    'recall:ideas': { v: 1, items: { 'idea:1': [0, today - 1, ''], 'idea:2': [2, today, ''] } },
  };
  const calls = [];
  globalThis.fetch = async (url) => {
    const u = new URL(String(url), 'https://cswork.test');
    calls.push(u.pathname + u.search);
    if (u.searchParams.get('prefix') === 'card:') return Response.json({ items: cards.map((target) => ({ target, body: '{}' })) });
    return Response.json({ target: u.searchParams.get('target'), body: JSON.stringify(notes[u.searchParams.get('target')]), updatedAt: 1 });
  };
  const navigations = [];
  const root = createRoot(document.getElementById('root'));
  const link = () => document.querySelector('.recall-none a');
  try {
    await act(async () => root.render(createElement(ReviewSessionLink, { signedIn: true, navigate: (...a) => navigations.push(a), english: true })));
    await settle();
    assert.equal(link().textContent, '3 more cards due → Review session', 'card a (new), card b (due), idea 1');
    await act(async () => link().dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })));
    assert.deepEqual(navigations, [['review-session']]);
    // Nothing due, or signed out: the plain way in, and signed out asks nothing.
    cards = [id('c')];
    notes['recall:ideas'].items = {};
    await act(async () => root.render(createElement('div')));
    await act(async () => root.render(createElement(ReviewSessionLink, { signedIn: true, navigate: () => {}, english: false })));
    await settle();
    assert.equal(link().textContent, '开始今日复习：卡片、选择题和编程题放在一个队列里 →');
    calls.length = 0;
    await act(async () => root.render(createElement('div')));
    await act(async () => root.render(createElement(ReviewSessionLink, { signedIn: false, navigate: () => {}, english: true })));
    await settle();
    assert.equal(link().getAttribute('href'), '/?view=review-session');
    assert.deepEqual(calls, []);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = original;
    dom.window.close();
  }
});

test('the rating card follows a revealed reference answer, with key points from the rubric, and a system design walkthrough', async () => {
  const dom = useDom();
  const { createRoot } = await import('react-dom/client');
  const { ContentDetail } = await import('../components/content-library.tsx');
  const { SdTryFirst } = await import('../app/system-design/reader.tsx');
  const original = globalThis.fetch;
  const body = [
    '# Design an LRU cache',
    '',
    'Support get and put in O(1).',
    '',
    '### What Interviewers Look For',
    '- **Hash map** plus a doubly linked list',
    '- Eviction on `put` when full',
    '',
    '## Solution',
    '',
    'Keep the most recent node at the head.',
  ].join('\n');
  const question = {
    type: 'interview_question', slug: 'lru', title: 'Design an LRU cache', titleZh: '设计 LRU 缓存', summary: null,
    company: null, role: null, category: 'Coding', difficulty: null, round: null, seniority: null, tags: [],
    publishedAt: null, partial: false, body, updatedAt: null, extra: {}, relations: [], dupOf: null, practice: null, companyPractice: null,
  };
  // A guest: the item loads, everything personal answers 401.
  globalThis.fetch = async (url) =>
    String(url).includes('/api/content/item') ? Response.json(question) : Response.json({ error: 'Sign in first' }, { status: 401 });
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () =>
      root.render(createElement(ContentDetail, { params: { type: 'interview_question', slug: 'lru' }, navigate() {}, problemIds: [], userId: null })),
    );
    await settle();
    assert.equal(document.querySelector('.recall'), null, 'nothing to grade before the answer shows');
    await act(async () => button('Show the answer').click());
    await act(async () => button('Show it anyway').click());
    await settle();
    assert.ok(document.querySelector('#ct-answer + .recall'), 'right after the reference answer');
    assert.deepEqual(
      [...document.querySelectorAll('.recall-points li')].map((li) => li.textContent),
      ['Hash map plus a doubly linked list', 'Eviction on put when full'],
    );
    await act(async () => button('Partly').click());
    await settle();
    assert.deepEqual(JSON.parse(localStorage.getItem('cswork:recall:v1')).items, { [T]: [0, today, 'Design an LRU cache'] });

    // A case chapter: the card shows once the walkthrough opens, with the chapter's title.
    await act(async () => root.render(createElement(SdTryFirst, { slug: 'url-shortener', title: 'Design a URL shortener', userId: null }, 'body')));
    await settle();
    assert.equal(document.querySelector('.recall'), null);
    await act(async () => button('Show the answer').click());
    await act(async () => button('Show it anyway').click());
    await settle();
    assert.ok(document.querySelector('.sd-walkthrough + .rd > .recall'));
    await act(async () => button('Knew it').click());
    await settle();
    assert.deepEqual(JSON.parse(localStorage.getItem('cswork:recall:v1')).items['sd:url-shortener'], [1, today, 'Design a URL shortener']);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = original;
    dom.window.close();
  }
});
