import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { register } from 'node:module';

register(
  `data:text/javascript,${encodeURIComponent("export async function load(url, context, next) { if (url.endsWith('.css')) return { format: 'module', source: 'export default {}', shortCircuit: true }; return next(url, context); }")}`,
  import.meta.url,
);

// The bank's SQL track: topic groups of published problems, progress and the next problem.
test('the SQL track lists published problems by topic and opens them', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { AlgorithmLibrary } = await import('../components/algorithm-library.tsx');
  const navigations = [];
  let authPrompts = 0;
  window.addEventListener('cswork:auth-required', () => authPrompts++);
  const root = createRoot(document.getElementById('root'));
  const render = (signedIn, availableProblemIds) =>
    act(async () => {
      root.render(
        createElement(AlgorithmLibrary, {
          key: `${signedIn}:${availableProblemIds.length}`,
          navigate: (...args) => navigations.push(args),
          availableProblemIds,
          collection: 'sql',
          // sql-04 is solved; lc-1 belongs to another list.
          activity: [{ problem_id: 'sql-04', created_at: 1 }, { problem_id: 'lc-1', created_at: 1 }],
          signedIn,
        }),
      );
    });
  const click = (node) =>
    act(async () => {
      node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  const published = ['sql-01', 'sql-04', 'sql-05', 'sql-16', 'lc-1'];
  try {
    // Nothing published yet: a plain notice, no rows.
    await render(true, ['lc-1']);
    assert.equal(document.querySelectorAll('a.study-row').length, 0);
    assert.ok(document.body.textContent.includes('being published'));

    // Guests see the published rows; opening one asks them to sign in.
    await render(false, published);
    const pressed = [...document.querySelectorAll('.algorithm-library-switch button')].find(
      (b) => b.getAttribute('aria-pressed') === 'true',
    );
    assert.ok(pressed?.textContent.includes('SQL track'));
    assert.equal(document.querySelectorAll('h1').length, 1);
    assert.ok(document.querySelector('.classic-board h1').textContent.includes('SQL Practice Track'));
    const headings = [...document.querySelectorAll('.classic-group h2')].map((h) => h.textContent.replace(/\d.*$/, ''));
    assert.deepEqual(headings, ['Filtering & NULL', 'Joins', 'Window functions']);
    const rows = [...document.querySelectorAll('a.study-row')];
    assert.equal(rows.length, 4);
    assert.equal(rows[0].getAttribute('href'), '/?view=problem&problem=sql-01');
    assert.ok(rows[0].textContent.includes('1. Employees Without a Valid Manager'));
    assert.ok(rows[3].textContent.includes('Hard'));
    assert.ok(!document.querySelector('progress'), 'guests have no progress bar');
    assert.ok(!document.querySelector('[data-progress="solved"]'), 'guests have no solved marks');
    await click(rows[1]);
    assert.equal(authPrompts, 1);
    assert.equal(navigations.length, 0);

    // Members get progress, the solved mark and the next unsolved problem.
    await render(true, published);
    const bar = document.querySelector('progress');
    assert.equal(bar?.getAttribute('max'), '4');
    assert.equal(bar?.getAttribute('value'), '1');
    assert.equal(document.querySelectorAll('[data-progress="solved"]').length, 1);
    assert.ok(document.querySelector('a.study-row[data-next]')?.getAttribute('href').endsWith('sql-01'));
    const start = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Start next problem');
    assert.ok(!!start);
    await click(start);
    assert.deepEqual(navigations.at(-1), ['problem', { problem: 'sql-01' }]);
    assert.equal(sessionStorage.getItem('cswork:problem-sequence'), '["sql-01","sql-04","sql-05","sql-16"]');
    assert.equal(sessionStorage.getItem('cswork:problem-library'), 'sql');
    await click(document.querySelectorAll('a.study-row')[2]);
    assert.deepEqual(navigations.at(-1), ['problem', { problem: 'sql-05' }]);

    // The other bank sections are one click away.
    const ling = [...document.querySelectorAll('.algorithm-library-switch button')][0];
    await click(ling);
    assert.deepEqual(navigations.at(-1), ['problems']);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
