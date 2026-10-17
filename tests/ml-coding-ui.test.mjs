import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

// CSS imports load as empty modules.
register(
  `data:text/javascript,${encodeURIComponent(`export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'export default {}',shortCircuit:true};return n(u,c);}`)}`,
  import.meta.url,
);
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/?view=problems&library=ml' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage', 'navigator'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');

// The bank's ML Coding section (?view=problems&library=ml): the SQL track's grouped list over the ML Coding manifest.
test('ML Coding lists published problems by group, with anchors the roadmap links to', async () => {
  const { MlCoding } = await import('../components/ml-coding.tsx');
  const navigations = [];
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () =>
      root.render(
        createElement(MlCoding, {
          navigate: (...args) => navigations.push(args),
          availableProblemIds: ['ml-roc-auc', 'ml-kmeans', 'ml-pca', 'core-deque'],
          activity: [{ problem_id: 'ml-roc-auc' }],
          signedIn: true,
        }),
      ),
    );
    assert.match(document.querySelector('.classic-board h1').textContent, /Machine Learning by Hand|机器学习手写实现/);
    // lib/server/role-paths.ts links ml-group steps to these headings.
    assert.deepEqual(
      [...document.querySelectorAll('.classic-group h2')].map((h) => h.id),
      ['ml-group-metrics', 'ml-group-models', 'ml-group-stats'],
    );
    const rows = [...document.querySelectorAll('a.study-row')];
    assert.equal(rows.length, 3);
    assert.ok(document.querySelector('a.study-row[data-next]').getAttribute('href').endsWith('ml-kmeans'));
    await act(async () => rows[2].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
    assert.deepEqual(navigations.at(-1), ['problem', { problem: 'ml-pca' }]);
    assert.equal(sessionStorage.getItem('cswork:problem-library'), 'ml');
  } finally {
    await act(async () => root.unmount());
  }
});
