import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

register(
  `data:text/javascript,${encodeURIComponent(
    `export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}`,
  )}`,
  import.meta.url,
);

test('progress page lists history, mistakes, reviews due today and the learner marks and notes', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://cswork.test/?view=progress',
  });
  for (const name of [
    'window',
    'document',
    'HTMLElement',
    'Element',
    'Node',
    'Event',
    'MouseEvent',
    'KeyboardEvent',
    'localStorage',
    'sessionStorage',
    'navigator',
  ])
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: dom.window[name],
    });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { MyProgress } = await import('../components/my-progress.tsx');
  const day = 86400000;
  const now = Date.now();
  const history = [
    {
      problemId: 'oa-acme-1',
      attempts: 2,
      firstAt: now - day,
      lastAt: now - day,
      firstAcAt: null,
      failuresBeforeAc: 2,
      lastStatus: 'wrong_answer',
      languages: ['python'],
      acAt: [],
      stop: null,
    },
    {
      problemId: 'lc-1',
      attempts: 4,
      firstAt: now - 40 * day,
      lastAt: now - 40 * day,
      firstAcAt: now - 40 * day,
      failuresBeforeAc: 3,
      lastStatus: 'accepted',
      languages: ['cpp'],
      acAt: [now - 40 * day],
      stop: 'hash-counting',
    },
  ];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.endsWith('/oj/history')) return Response.json({ items: history });
    if (url.endsWith('/oj/marks'))
      return Response.json({
        items: [
          { target: 'problem:lc-1', mark: 'star', createdAt: now },
          { target: 'problem:lc-2', mark: 'redo', createdAt: now },
          { target: 'content:interview_question/x', mark: 'star', createdAt: now },
        ],
      });
    if (url.endsWith('/oj/notes'))
      return Response.json({ items: [{ target: 'problem:lc-1', updatedAt: now }] });
    if (url.endsWith('/oj/library?collection=ling-selected-500'))
      return Response.json({
        collection: {
          sections: [
            { slug: 'array-foundations', solved: 1, total: 2 },
            // This round shows nothing solved, but lc-1 was accepted here before.
            { slug: 'hash-counting', solved: 0, total: 1 },
          ],
        },
      });
    throw new Error(`unexpected ${url}`);
  };
  const navigations = [];
  const boot = {
    person: { id: 'me' },
    problems: [
      { id: 'lc-1', title: '两数之和', titleEn: 'Two Sum', difficulty: '简单', tags: [] },
      { id: 'lc-2', title: '两数相加', titleEn: 'Add Two Numbers', difficulty: '中等', tags: [] },
      { id: 'oa-acme-1', title: 'Acme OA', difficulty: '困难', tags: [] },
    ],
    activity: [],
  };
  const root = createRoot(document.getElementById('root'));
  const settle = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  const tab = (name) => document.querySelector(`#progress-tab-${name}`);
  // Visible titles; the star's screen-reader text is checked on its own.
  const titles = () =>
    [...document.querySelectorAll('.progress-row strong')].map((n) => {
      const copy = n.cloneNode(true);
      copy.querySelectorAll('.sr-only').forEach((x) => x.remove());
      return copy.textContent.trim();
    });
  try {
    await act(async () =>
      root.render(
        createElement(MyProgress, {
          boot,
          navigate: (view, extra) => navigations.push([view, extra]),
        }),
      ),
    );
    await settle();
    assert.equal(document.querySelector('h1').textContent, 'My progress');
    assert.deepEqual(
      [...document.querySelectorAll('[role="tab"] .progress-count')].map((n) => n.textContent),
      ['2', '2', '1', '1', '1', '1', '1'],
      'history, mistakes, due, starred (problems only), redo, notes, badges earned',
    );
    assert.deepEqual(titles(), ['Acme OA', '1. Two Sum']);
    assert.ok(!!document.querySelector('.progress-row .study-star'), 'starred rows show the star');
    assert.match(document.querySelectorAll('.progress-row strong')[1].textContent, /\(starred\)/);
    assert.match(document.querySelector('.progress-stop').textContent, /Hashing/);
    // Filters narrow the history in place.
    const select = document.querySelectorAll('.progress-filters select')[0];
    await act(async () => {
      select.value = 'oa';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    assert.deepEqual(titles(), ['Acme OA']);
    // Arrow keys move between tabs.
    await act(async () =>
      tab('history').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      ),
    );
    assert.equal(tab('mistakes').getAttribute('aria-selected'), 'true');
    assert.ok(document.activeElement === tab('mistakes'));
    assert.deepEqual(titles(), ['Acme OA', '1. Two Sum']);
    await act(async () => tab('review').click());
    assert.deepEqual(titles(), ['1. Two Sum']);
    assert.match(document.querySelector('.progress-detail').textContent, /overdue/);
    await act(async () => tab('starred').click());
    assert.deepEqual(titles(), ['1. Two Sum'], 'the Starred tab lists star marks');
    await act(async () => tab('redo').click());
    assert.deepEqual(titles(), ['2. Add Two Numbers']);
    assert.match(document.querySelector('.progress-detail').textContent, /Not submitted yet/);
    const link = document.querySelector('.progress-row');
    assert.equal(link.getAttribute('href'), '/?view=problem&problem=lc-2');
    await act(async () => link.click());
    assert.deepEqual(navigations, [['problem', { problem: 'lc-2' }]]);
    assert.equal(sessionStorage.length > 0, true, 'prev/next follows the tab list');
    await act(async () => tab('notes').click());
    assert.deepEqual(titles(), ['1. Two Sum']);
    // The badge wall: stop roundels in line order, milestones with their progress.
    await act(async () => tab('badges').click());
    const stops = [...document.querySelectorAll('.badge-stops li')];
    assert.equal(stops.length, 2);
    assert.deepEqual(stops.map((li) => li.hasAttribute('data-earned')), [false, true]);
    assert.match(stops[0].textContent, /1 of 2 solved/);
    assert.match(stops[1].textContent, /Hashing, cleared/);
    assert.match(document.querySelector('.badge-board-head p').textContent, /1 of 2 stops cleared/);
    const medals = [...document.querySelectorAll('.badge-medal')].map((m) => m.textContent);
    assert.deepEqual(medals.slice(0, 3), ['77-day streak1 / 7', '3030-day streak1 / 30', '100100-day streak1 / 100']);
    assert.equal(medals.length, 6, 'three streaks, two active-day counts and the perfect mock');
    assert.match(document.querySelector('.badge-empty').textContent, /3\+ problems/);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
  }
});
