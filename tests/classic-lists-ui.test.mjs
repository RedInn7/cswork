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
  const posts = [];
  // Members' hand ticks, as the server keeps them (user_marks done).
  const done = new Set();
  let failPost = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    requests.push(url);
    if (init?.method === 'POST') {
      const body = JSON.parse(init.body);
      posts.push(body);
      if (failPost) return Response.json({ error: '笔记或标记已达上限' }, { status: 409 });
      for (const target of body.targets ?? [body.target]) {
        const n = Number(target.slice('problem:lc-'.length));
        if (body.on === false) done.delete(n);
        else done.add(n);
      }
      return Response.json({ ok: true });
    }
    return Response.json({
      ...view,
      groups: view.groups.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i, done: done.has(i.number) })) })),
    });
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
    // The site switch: leetcode.cn instead, remembered by this browser.
    const site = (name) => [...document.querySelectorAll('.classic-site button')].find((b) => b.textContent === name);
    assert.equal(site('LeetCode US').getAttribute('aria-pressed'), 'true');
    await click(site('LeetCode CN'));
    assert.equal(rows[1].getAttribute('href'), 'https://leetcode.cn/problemset/?search=9999');
    assert.equal(localStorage.getItem('cswork:lc-site'), 'cn');
    await click(site('LeetCode US'));
    assert.equal(rows[1].getAttribute('href'), 'https://leetcode.com/problemset/?search=9999');
    // Guests tick problems by hand, any row, kept in this browser and counted in the bar.
    let bar = document.querySelector('progress');
    assert.equal(bar.getAttribute('max'), '3');
    // (This mock answers lc-1 solved even for a guest.)
    assert.equal(bar.getAttribute('value'), '1');
    assert.ok(document.body.textContent.includes('1 of 3 done'));
    assert.ok(document.body.textContent.includes('2 judgeable here'));
    const box = (n) => document.querySelector(`input[aria-label^="Done: ${n}."]`);
    assert.equal(document.querySelectorAll('.classic-tick input').length, 3);
    await click(box(9999));
    assert.equal(box(9999).checked, true);
    assert.equal(localStorage.getItem('cswork:list-done:blind-75'), '[9999]');
    assert.equal(bar.getAttribute('value'), '2');
    assert.equal(document.querySelector('.classic-manual').textContent, '1 ticked by hand');
    assert.equal(posts.length, 0, 'nothing leaves the browser');
    assert.ok(
      [...document.querySelectorAll('button')].some((b) => b.textContent === 'Sign in to sync across devices'),
    );
    await click(rows[0]);
    assert.equal(authPrompts, 1);
    assert.equal(navigations.length, 0);

    // Signing in moves the browser's ticks into the account in one batch, then clears them.
    await render(true);
    await act(async () => new Promise((r) => setTimeout(r, 10)));
    assert.deepEqual(posts[0], { targets: ['problem:lc-9999'], mark: 'done' });
    assert.equal(localStorage.getItem('cswork:list-done:blind-75'), null);
    // The bar counts problems solved here or ticked by hand.
    bar = document.querySelector('progress');
    assert.equal(bar.getAttribute('max'), '3');
    assert.equal(bar.getAttribute('value'), '2');
    assert.equal(box(9999).checked, true, 'the ticks come back from the account');
    assert.ok(document.body.textContent.includes('2 of 3 done'));
    // A member's tick is a done mark; a refused one rolls back with the server's reason.
    await click(box(21));
    assert.deepEqual(posts.at(-1), { target: 'problem:lc-21', mark: 'done', on: true });
    assert.equal(bar.getAttribute('value'), '3');
    failPost = true;
    await click(box(21));
    await act(async () => new Promise((r) => setTimeout(r, 10)));
    assert.equal(box(21).checked, true);
    assert.equal(document.querySelector('.classic-tick-error').textContent, "You've reached the limit for notes or marks");
    failPost = false;
    await click(box(21));
    assert.equal(box(21).checked, false);
    assert.ok(!document.querySelector('.classic-tick-error'), 'the next tick clears it');
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
