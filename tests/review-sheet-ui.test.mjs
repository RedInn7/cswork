// The notes tab's export (components/cheatsheet.tsx) and /review-sheet (components/review-sheet.tsx):
// paged export into a vault zip, the one-page sheet's rows, and the review book's chapters.
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

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/review-sheet' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'localStorage', 'sessionStorage', 'navigator', 'history', 'location'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { NotesExport } = await import('../components/cheatsheet.tsx');
const { ReviewSheet } = await import('../components/review-sheet.tsx');
const { unzip } = await import('../lib/zip.ts');

const settle = () => act(async () => new Promise((r) => setTimeout(r, 20)));
async function mount(element) {
  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(element));
  await settle();
  return root;
}
const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(text));

test('the export reads every page, with code when ticked, and saves a vault zip', async () => {
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(url);
    return url.includes('cursor=')
      ? Response.json({ items: [{ target: 'story:1', body: '{"title":"Outage","situation":"S"}', updatedAt: 1 }], nextCursor: null })
      : Response.json({
          items: [
            { target: 'problem:lc-1', body: '#哈希表 one pass', updatedAt: 1, lastAc: 1, code: { language: 'python', code: 'pass' }, meta: { title: '两数之和', titleEn: 'Two Sum', stop: 'hash-counting' } },
            { target: 'problem:oa-acme-1', body: 'oa note', updatedAt: 1 },
          ],
          nextCursor: 'problem:oa-acme-1',
        });
  };
  const saved = [];
  URL.createObjectURL = (blob) => (saved.push(blob), 'blob:x');
  URL.revokeObjectURL = () => {};
  const names = [];
  dom.window.HTMLAnchorElement.prototype.click = function () {
    names.push(this.download);
  };
  const problems = [{ id: 'oa-acme-1', title: 'Acme 题', titleEn: 'Acme OA', difficulty: '困难', tags: ['图'] }];
  const root = await mount(createElement(NotesExport, { english: true, problems }));
  const code = document.querySelector('.notes-export-code input');
  await act(async () => code.click());
  await act(async () => button('.zip').click());
  await settle();
  assert.deepEqual(
    urls.map((u) => u.replace('/api/oj/notes/export?', '')),
    ['code=1', 'code=1&cursor=problem%3Aoa-acme-1'],
  );
  assert.match(names[0], /^cswork-notes-\d{4}-\d{2}-\d{2}\.zip$/);
  const files = await unzip(new Uint8Array(await saved[0].arrayBuffer()), () => true, 1 << 20);
  assert.deepEqual([...files.keys()], ['index.md', 'problems/hash-counting/lc-1.md', 'problems/oa/oa-acme-1.md', 'stories/star-stories.md']);
  const oa = new TextDecoder().decode(files.get('problems/oa/oa-acme-1.md'));
  assert.match(oa, /^---\ntitle: "Acme OA"\n[\s\S]*difficulty: "Hard"\ntopics: \["图"\]/, 'titles the server lacks come from the bootstrap list');
  assert.match(new TextDecoder().decode(files.get('problems/hash-counting/lc-1.md')), /```python\npass\n```/);
  assert.equal(document.querySelector('.notes-export-status').textContent, 'Exported 3 notes');
  // A failed page shows the server's message.
  globalThis.fetch = async () => Response.json({ error: 'The notes export and review sheet are closed while your contest or exam runs' }, { status: 403 });
  await act(async () => button('.md').click());
  await settle();
  assert.match(document.querySelector('.notes-export-status.is-error').textContent, /closed while your contest/);
  await act(async () => root.unmount());
});

test('the one-page sheet loads the linked scope, warns past 40 rows, reorders, drops and prints', async () => {
  const urls = [];
  const rows = Array.from({ length: 41 }, (_, i) => ({
    id: `lc-${i + 1}`,
    title: `题 ${i + 1}`,
    titleEn: `Problem ${i + 1}`,
    difficulty: null,
    marks: i === 1 ? ['redo'] : [],
    wrong: false,
    leech: i === 0,
    gist: i === 2 ? null : `gist ${i + 1}`,
    hint: i === 2 ? { zh: '提示', en: 'use a set' } : null,
    tags: i === 0 ? ['双指针'] : [],
    confidence: null,
  }));
  globalThis.fetch = async (url) => {
    urls.push(url);
    return Response.json({
      kind: 'stops',
      name: null,
      stops: ['two-pointers-windows'],
      total: 41,
      rows,
      topics: [{ stop: 'two-pointers-windows', text: 'left and right' }],
      cards: [{ id: 'c', front: 'Why sort?', back: 'Two pointers' }],
    });
  };
  let printed = 0;
  dom.window.print = () => printed++;
  const root = await mount(createElement(ReviewSheet, { zh: false, book: false, by: '', company: '', stops: 'two-pointers-windows,nowhere,constructor', list: '' }));
  assert.deepEqual(urls, ['/api/oj/cheatsheet?stops=two-pointers-windows'], 'unknown stops, prototype names too, are dropped from the link');
  assert.equal(location.search, '?stops=two-pointers-windows');
  const ids = () => [...document.querySelectorAll('.rs-rows li b')].map((b) => b.textContent);
  assert.deepEqual(ids().slice(0, 3), ['1', '2', '3']);
  assert.equal(document.querySelector('#rs-title').textContent, 'Two Pointers');
  assert.match(document.querySelector('.rs-warn').textContent, /Past 40 rows/);
  assert.match(document.querySelector('.rs-rows li:nth-child(3)').textContent, /Hint: use a set/);
  assert.deepEqual([...document.querySelectorAll('.rs-rows li:first-child .rs-badge')].map((b) => b.textContent), ['Leech']);
  assert.equal(document.querySelector('.rs-extra dt').textContent, 'Why sort?');
  assert.equal(document.querySelector('[aria-label="Move Problem 1 up"]').disabled, true);
  await act(async () => document.querySelector('[aria-label="Move Problem 1 down"]').click());
  assert.deepEqual(ids().slice(0, 2), ['2', '1']);
  await act(async () => document.querySelector('[aria-label="Remove Problem 2 from the sheet"]').click());
  assert.equal(ids().length, 40);
  assert.equal(document.querySelector('.rs-warn'), null, '40 rows fit on a page');
  await act(async () => button('Print').click());
  assert.equal(printed, 1);
  await act(async () => root.unmount());
});

test('the review book reads every problem note into a chapter per stop, other problems last', async () => {
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(url);
    return Response.json({
      items: [
        { target: 'problem:lc-15', body: '## Key observation\nsort first', updatedAt: 1, meta: { title: '三数之和', titleEn: '3Sum', stop: 'two-pointers-windows', order: 5 } },
        { target: 'problem:lc-1', body: 'hash it, see [[lc-15]]', updatedAt: 1, meta: { titleEn: 'Two Sum', stop: 'hash-counting', order: 1 } },
        { target: 'problem:oa-acme-1', body: 'oa', updatedAt: 1 },
        { target: 'problem:lc-11', body: 'shrink the shorter side', updatedAt: 1, meta: { titleEn: 'Container', stop: 'two-pointers-windows', order: 3 } },
      ],
      nextCursor: null,
    });
  };
  const root = await mount(createElement(ReviewSheet, { zh: false, book: true, by: 'stop', company: '', stops: '', list: '' }));
  assert.deepEqual(urls, ['/api/oj/notes/export?prefix=problem']);
  assert.deepEqual([...document.querySelectorAll('.rs-chapter > h2')].map((h) => h.textContent), ['Hashing', 'Two Pointers', 'Other problems']);
  assert.deepEqual(
    [...document.querySelectorAll('.rs-entry > h3')].map((h) => h.textContent),
    ['1. Two Sum', '11. Container', '15. 3Sum', 'oa-acme-1'],
    'route order inside a stop',
  );
  assert.equal(document.querySelector('.rs-entry-body a[href*="lc-15"]').textContent, 'lc-15', '[[lc-15]] becomes a link');
  assert.equal(document.querySelector('.rs-ways a[aria-current="page"]').textContent, 'By Line 500 stop');
  const hot = [...document.querySelectorAll('.rs-ways a')].find((a) => a.textContent === 'LeetCode Top 100 Liked');
  // dispatchEvent: the export test stubbed HTMLAnchorElement#click.
  await act(async () => hot.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })));
  assert.deepEqual(urls, ['/api/oj/notes/export?prefix=problem'], 'switching chapters reads nothing again');
  assert.equal(location.search, '?view=book&by=list%3Aleetcode-hot-100');
  assert.equal(document.querySelector('.rs-ways a[aria-current="page"]'), hot);
  assert.deepEqual([...document.querySelectorAll('.rs-chapter > h2')].map((h) => h.textContent), ['Hashing', 'Two Pointers']);
  await act(async () => root.unmount());
});
