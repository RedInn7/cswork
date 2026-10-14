import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { register } from 'node:module';

register(
  `data:text/javascript,${encodeURIComponent("export async function load(url, context, next) { if (url.endsWith('.css')) return { format: 'module', source: 'export default {}', shortCircuit: true }; return next(url, context); }")}`,
  import.meta.url,
);

// The bank's classic list view: groups, external rows, progress and the picker.
test('classic lists show groups and progress, link external problems out and switch lists', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://cswork.test/',
  });
  for (const name of [
    'window',
    'document',
    'HTMLElement',
    'Element',
    'Node',
    'Event',
    'MouseEvent',
    'localStorage',
    'sessionStorage',
  ])
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: dom.window[name],
    });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { AlgorithmLibrary } = await import('../components/algorithm-library.tsx');
  const item = (number, judgeable, extra = {}) => ({
    number,
    slug: `p-${number}`,
    titleZh: `题${number}`,
    titleEn: `Problem ${number}`,
    difficulty: 'Medium',
    judgeProblemId: judgeable ? `lc-${number}` : null,
    external: !judgeable,
    stop: null,
    solved: false,
    progressStatus: 'not_started',
    judging: false,
    ...extra,
  });
  const view = {
    collection: { id: 'blind-75', total: 3, ready: 2, solved: 1 },
    groups: [
      {
        nameZh: '数组',
        nameEn: 'Array',
        total: 2,
        ready: 1,
        solved: 1,
        items: [
          item(1, true, {
            solved: true,
            progressStatus: 'solved',
            stop: { slug: 'hash-counting', code: '02', nameZh: '哈希计数', nameEn: 'Hashing' },
          }),
          item(9999, false, { slug: '', titleZh: '', titleEn: '' }),
        ],
      },
      { nameZh: '链表', nameEn: 'Linked List', total: 1, ready: 1, solved: 0, items: [item(21, true)] },
    ],
    sequence: ['lc-1', 'lc-21'],
    nextProblemId: 'lc-21',
  };
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    requests.push(url);
    return Response.json(view);
  };
  const navigations = [];
  let authPrompts = 0;
  window.addEventListener('cswork:auth-required', () => authPrompts++);
  const root = createRoot(document.getElementById('root'));
  const render = (signedIn) =>
    act(async () => {
      root.render(
        createElement(AlgorithmLibrary, {
          key: String(signedIn),
          navigate: (...args) => navigations.push(args),
          availableProblemIds: [],
          collection: 'blind-75',
          activity: [],
          signedIn,
        }),
      );
      await new Promise((r) => setTimeout(r, 10));
    });
  const click = (node) =>
    act(async () => {
      node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  try {
    // Guests browse the list; judgeable rows ask them to sign in.
    await render(false);
    assert.ok(requests[0].endsWith('/api/oj/library?collection=blind-75'));
    assert.ok(!document.querySelector('.route-stops'), 'no metro line');
    assert.equal(document.querySelectorAll('h1').length, 1);
    assert.ok(document.querySelector('.classic-board h1').textContent.includes('Blind 75'));
    const headings = [...document.querySelectorAll('.classic-group h2')].map((h) => h.textContent);
    assert.deepEqual(
      headings.map((h) => h.split(/\d/)[0]),
      ['Array', 'Linked List'],
    );
    const rows = [...document.querySelectorAll('a.study-row')];
    assert.equal(rows.length, 3);
    assert.equal(rows[0].getAttribute('href'), '/?view=problem&problem=lc-1');
    assert.equal(rows[0].querySelector('.classic-stop')?.textContent, '02Hashing');
    // An unknown external number searches LeetCode in the reader's language and opens a new tab.
    assert.equal(rows[1].getAttribute('href'), 'https://leetcode.com/problemset/?search=9999');
    assert.equal(rows[1].getAttribute('target'), '_blank');
    assert.ok(rows[1].textContent.includes('External'));
    assert.ok(rows[1].textContent.includes('LeetCode 9999'));
    assert.ok(!document.querySelector('progress'), 'guests have no progress bar');
    assert.ok(document.body.textContent.includes('2 of 3 judgeable here'));
    await click(rows[0]);
    assert.equal(authPrompts, 1);
    assert.equal(navigations.length, 0);

    // Members get the bar over judgeable problems and the next problem.
    await render(true);
    const bar = document.querySelector('progress');
    assert.ok(!!bar);
    assert.equal(bar.getAttribute('max'), '2');
    assert.equal(bar.getAttribute('value'), '1');
    assert.ok(!!document.querySelector('a.study-row[data-next]'));
    const start = [...document.querySelectorAll('button')].find(
      (b) => b.textContent === 'Start next problem',
    );
    assert.ok(!!start);
    await click(start);
    assert.deepEqual(navigations.at(-1), ['problem', { problem: 'lc-21' }]);
    assert.equal(sessionStorage.getItem('cswork:problem-sequence'), '["lc-1","lc-21"]');
    assert.equal(sessionStorage.getItem('cswork:problem-library'), 'blind-75');
    await click(document.querySelector('a.study-row'));
    assert.deepEqual(navigations.at(-1), ['problem', { problem: 'lc-1' }]);

    // A failed background refresh keeps the list on screen.
    globalThis.fetch = async () => Response.json({ error: 'busy' }, { status: 429 });
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await new Promise((r) => setTimeout(r, 10));
    });
    assert.ok(!document.querySelector('.classic-list [role="alert"]'));
    assert.equal(document.querySelectorAll('a.study-row').length, 3);

    // The picker shows the current list and switches to another.
    const picker = document.querySelector('.algorithm-library-lists select');
    assert.equal(picker.value, 'blind-75');
    assert.equal(picker.closest('label').hasAttribute('data-active'), true);
    await act(async () => {
      picker.value = 'grind-75';
      picker.dispatchEvent(new Event('change', { bubbles: true }));
    });
    assert.deepEqual(navigations.at(-1), ['problems', { library: 'grind-75' }]);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
});
