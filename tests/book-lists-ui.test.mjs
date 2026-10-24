import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { register } from 'node:module';

register(
  `data:text/javascript,${encodeURIComponent("export async function load(url, context, next) { if (url.endsWith('.css')) return { format: 'module', source: 'export default {}', shortCircuit: true }; return next(url, context); }")}`,
  import.meta.url,
);

// A book list (剑指 Offer): rows carry the book number, the LeetCode twin when
// there is one; problems without a twin open their own leetcode.cn page, or the
// workspace once cswork's rewrite is judged here (the original stays a reference).
test('book lists label rows by book number, show twins and coverage, link twinless problems to leetcode.cn or their rewrite', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
  dom.window.localStorage.setItem('cswork:locale', 'en'); // UI copy below is the English site
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { ClassicList } = await import('../components/classic-list.tsx');
  const item = (ref, number, judgeable, extra = {}) => ({
    number,
    ref,
    refSlug: `slug-${ref}-lcof`,
    slug: number ? `p-${number}` : '',
    titleZh: number ? `题${number}` : '',
    titleEn: number ? `Problem ${number}` : '',
    difficulty: number ? 'Medium' : '',
    judgeProblemId: judgeable ? `lc-${number}` : null,
    external: !judgeable,
    stop: null,
    solved: false,
    progressStatus: 'not_started',
    judging: false,
    ...extra,
  });
  const view = {
    collection: { id: 'sword-offer', total: 4, mapped: 2, ready: 2, solved: 1 },
    groups: [
      {
        nameZh: '第 2 章',
        nameEn: 'Chapter 2',
        total: 4,
        ready: 2,
        solved: 1,
        items: [
          item('03', null, false),
          item('07', 105, true),
          item('14-II', 343, false),
          item('05', null, false, {
            titleEn: 'Encode Spaces as %20',
            difficulty: '简单',
            judgeProblemId: 'bk-offer-05',
            external: false,
            solved: true,
            progressStatus: 'solved',
          }),
        ],
      },
    ],
    sequence: ['lc-105', 'bk-offer-05'],
    nextProblemId: 'lc-105',
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json(view);
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => {
      root.render(createElement(ClassicList, { slug: 'sword-offer', navigate: () => {}, signedIn: true }));
      await new Promise((r) => setTimeout(r, 10));
    });
    const rows = [...document.querySelectorAll('a.study-row')];
    assert.equal(rows.length, 4);
    const numbers = rows.map((row) => row.querySelector('.study-number').textContent);
    assert.deepEqual(numbers, ['Offer 03', 'Offer 07', 'Offer 14-II', 'Offer 05']);
    // No twin: the book's own page, in a new tab, with a plain label.
    assert.equal(rows[0].getAttribute('href'), 'https://leetcode.cn/problems/slug-03-lcof/');
    assert.equal(rows[0].getAttribute('target'), '_blank');
    assert.ok(rows[0].textContent.includes('On leetcode.cn'));
    assert.equal(!!rows[0].querySelector('.classic-twin'), false);
    // A judgeable twin opens here and names the LeetCode number.
    assert.equal(rows[1].getAttribute('href'), '/?view=problem&problem=lc-105');
    assert.equal(rows[1].querySelector('.classic-twin').textContent, 'LeetCode 105');
    assert.ok(rows[1].textContent.includes('Problem 105'));
    // A twin not judgeable here still links the book's page.
    assert.equal(rows[2].getAttribute('href'), 'https://leetcode.cn/problems/slug-14-II-lcof/');
    assert.ok(rows[2].textContent.includes('External'));
    assert.ok(document.querySelector('.classic-coverage').textContent.includes('2 of 4 have a LeetCode twin'));
    // A rewrite judged here opens the workspace, is not external, and keeps the original as a reference.
    assert.equal(rows[3].getAttribute('href'), '/?view=problem&problem=bk-offer-05');
    assert.equal(rows[3].hasAttribute('target'), false);
    assert.ok(rows[3].textContent.includes('Encode Spaces as %20') && !rows[3].textContent.includes('External'));
    assert.ok(rows[3].querySelector('[data-progress="solved"]'));
    const originals = [...document.querySelectorAll('a.classic-source')];
    assert.equal(originals.length, 1);
    assert.equal(originals[0].getAttribute('href'), 'https://leetcode.cn/problems/slug-05-lcof/');
    assert.equal(originals[0].getAttribute('target'), '_blank');
    assert.match(originals[0].textContent, /Original: Offer 05 Encode Spaces as %20 \(opens in a new tab\)/);
    // Only problems with a LeetCode number can be ticked; the bar counts those and the rewrites.
    assert.deepEqual(
      [...document.querySelectorAll('.classic-tick input')].map((box) => box.getAttribute('aria-label')),
      ['Done: Offer 07 Problem 105', 'Done: Offer 14-II Problem 343'],
    );
    assert.equal(document.querySelector('progress').getAttribute('max'), '3');
    assert.equal(document.querySelector('progress').getAttribute('value'), '1');
    // The source link is the URL alone.
    const source = [...document.querySelectorAll('.classic-lead a')].find((a) => a.textContent.includes('Original list'));
    assert.equal(source.getAttribute('href'), 'https://leetcode.cn/studyplan/coding-interviews/');
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
});
