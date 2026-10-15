// The system design reader: parts and read progress on the index, the on-page table of contents
// (ids shared with the markdown renderer), mermaid diagrams, mark-as-read and the try-first gate.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createElement, Fragment, act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const react = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
const prefix = `import React from ${JSON.stringify(react)};`;
const mocks = {
  'next/headers': `export const cookies = async () => ({ get: () => (globalThis.__locale ? { value: globalThis.__locale } : undefined) }); export const headers = async () => new Headers();`,
  'next/navigation': `export function notFound() { throw Object.assign(new Error('NEXT_NOT_FOUND'), { digest: 'NEXT_NOT_FOUND' }); }`,
  'next/link': `${prefix}export default function Link({ href, prefetch, children, ...rest }) { return React.createElement('a', { href, ...rest }, children); }`,
};
register(
  `data:text/javascript,${encodeURIComponent(`const mocks=${JSON.stringify(mocks)};
export async function resolve(s,c,n){if(s.startsWith('next/')&&mocks[s])return {url:'mock:'+s,shortCircuit:true};return n(s,c);}
export async function load(u,c,n){
  if(u.startsWith('mock:'))return {format:'module',source:mocks[u.slice(5)],shortCircuit:true};
  if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};
  return n(u,c);}`)}`,
  import.meta.url,
);

const course = JSON.parse(readFileSync(new URL('../lib/content/system-design-course.json', import.meta.url), 'utf8'));
const slugs = course.chapters.map((chapter) => chapter.slug);
const parse = (html) => new JSDOM(`<main>${html}</main>`).window.document;
const params = (slug) => ({ params: Promise.resolve({ slug }) });
const settle = () => act(async () => new Promise((r) => setTimeout(r, 10)));

function useDom(url = 'https://cswork.test/system-design/url-shortener') {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'navigator', 'location'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  return dom;
}
/** Answers /api/oj/marks like the server: `read` is the signed-in learner's read chapters, null when signed out. */
function marksApi(read, { failPost = false } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    calls.push([init.method ?? 'GET', u, init.body ? JSON.parse(init.body) : undefined]);
    if (!read) return Response.json({ error: 'Sign in first' }, { status: 401 });
    if (u.startsWith('/api/oj/notes')) return Response.json({ target: 'x', body: '', updatedAt: null });
    if (init.method === 'POST') {
      if (failPost) return Response.json({ error: 'Too many requests' }, { status: 429 });
      const d = JSON.parse(init.body);
      if (d.on) read.add(d.target);
      else read.delete(d.target);
      return Response.json(d);
    }
    return Response.json({ items: [...read, 'problem:lc-1'].map((target) => ({ target, mark: 'read', createdAt: 1 })) });
  };
  return calls;
}

test('the index groups chapters into parts; a chapter renders its table of contents, outline and gate', async () => {
  const { default: Index } = await import('../app/system-design/page.tsx');
  const { default: Chapter } = await import('../app/system-design/[slug]/page.tsx');
  globalThis.__locale = 'zh';
  let doc = parse(renderToStaticMarkup(await Index()));
  const parts = [...doc.querySelectorAll('.sd-part')];
  assert.deepEqual(parts.map((part) => part.querySelector('h2').textContent), ['系统设计：框架与案例', '面向对象设计（LLD）', '并发编程', 'ML 系统设计']);
  assert.deepEqual(
    [...parts[3].querySelectorAll('.sd-sheets a')].map((a) => a.getAttribute('href')),
    ['ml-design-framework', 'recsys-ranking', 'search-ranking', 'ads-ctr', 'fraud-detection'].map((slug) => `/system-design/${slug}`),
  );
  // Chapter numbers run on across parts.
  assert.equal(parts[3].querySelector('.sd-sheet-no').textContent, `第 ${slugs.indexOf('ml-design-framework') + 1} 章`);
  // Progress needs the learner's marks, which only the browser asks for.
  assert.equal(doc.querySelector('.sd-read-count'), null);

  globalThis.__locale = 'en';
  doc = parse(renderToStaticMarkup(await Chapter(params('framework'))));
  const ids = [...doc.querySelectorAll('.public-library-prose h2[id]')].map((h) => h.id);
  assert.ok(ids.length > 3);
  for (const toc of ['.sd-toc-top', '.sd-toc'])
    assert.deepEqual(
      [...doc.querySelectorAll(`${toc} a`)].map((a) => a.getAttribute('href')),
      [...ids.map((id) => `#${id}`), '#sd-quiz-title'],
    );
  assert.ok(doc.getElementById('sd-quiz-title'), 'the quiz heading is a target');
  const outline = [...doc.querySelectorAll('.sd-outline a')];
  assert.deepEqual(outline.map((a) => a.getAttribute('href')), slugs.map((slug) => `/system-design/${slug}`));
  assert.deepEqual(outline.filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.textContent), [course.chapters[0].titleEn]);
  assert.equal(doc.querySelector('.sd-progress').getAttribute('aria-hidden'), 'true');
  assert.equal(doc.querySelector('.sd-try'), null, 'the framework is not a design exercise');
  assert.ok(doc.querySelector('.sd-read input[type="checkbox"]').disabled, 'mark as read waits for the marks');

  doc = parse(renderToStaticMarkup(await Chapter(params('url-shortener'))));
  assert.ok(doc.querySelector('.sd-try .ip-try textarea'));
  const walkthrough = doc.querySelector('.sd-walkthrough');
  assert.ok(walkthrough.hasAttribute('data-closed') && walkthrough.hasAttribute('inert'));
  assert.ok(walkthrough.querySelector('.public-library-prose h2[id]'), 'the walkthrough stays in the page');
  // Diagrams draw in the browser; the page carries their source and no bare mermaid code block.
  const figure = walkthrough.querySelector('figure.course-diagram');
  assert.ok(figure.querySelector('details pre code').textContent.startsWith('flowchart LR'));
  assert.equal(walkthrough.querySelector(':not(details) > pre > code.language-mermaid'), null);
});

test('table of contents ids match the rendered headings in every chapter', async () => {
  const { PublicLibraryMarkdown, markdownToc } = await import('../app/library/markdown.tsx');
  const rendered = (body) =>
    [...parse(renderToStaticMarkup(createElement(PublicLibraryMarkdown, { body, math: false, sectionIds: true }))).querySelectorAll('h2[id]')].map(
      (h) => [h.id, h.textContent],
    );
  const body = '# Intro\n\n```\n# not a heading\n## nor this\n```\n\n## Intro\n\n## [The **API**](https://x.test) `v2`\n\n### Detail\n\n## 1. 需求澄清：读写比！';
  assert.deepEqual(markdownToc(body), [
    { id: 'intro', text: 'Intro' },
    { id: 'intro-2', text: 'Intro' },
    { id: 'the-api-v2', text: 'The API v2' },
    { id: '1-需求澄清读写比', text: '1. 需求澄清：读写比！' },
  ]);
  assert.deepEqual(rendered(body), markdownToc(body).map(({ id, text }) => [id, text]));
  for (const chapter of course.chapters)
    for (const key of ['bodyZh', 'bodyEn']) {
      const ids = markdownToc(chapter[key]).map((section) => section.id);
      assert.deepEqual(rendered(chapter[key]).map(([id]) => id), ids, `${chapter.slug}.${key}`);
      assert.equal(new Set(ids).size, ids.length);
    }
  // Without the option, and in member posts, nothing changes; member mermaid stays code.
  assert.equal(parse(renderToStaticMarkup(createElement(PublicLibraryMarkdown, { body, math: false }))).querySelector('h2[id]'), null);
  const ugc = parse(renderToStaticMarkup(createElement(PublicLibraryMarkdown, { body: '```mermaid\nflowchart LR\n  a --> b\n```', math: false, ugc: true })));
  assert.equal(ugc.querySelector('figure'), null);
  assert.ok(ugc.querySelector('pre > code.language-mermaid'));
});

test('signed in: one request for the marks, read ticks and count, and marking a chapter read', async () => {
  const dom = useDom();
  const { createRoot } = await import('react-dom/client');
  const { SdMarkRead, SdReadCheck, SdReadCount } = await import('../app/system-design/reader.tsx');
  const original = globalThis.fetch;
  const read = new Set(['sd:framework', 'sd:url-shortener/draft']);
  const calls = marksApi(read);
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () =>
      root.render(
        createElement(
          Fragment,
          null,
          createElement(SdReadCount, { slugs }),
          createElement('p', { id: 'a' }, createElement(SdReadCheck, { slug: 'framework' })),
          createElement('p', { id: 'b' }, createElement(SdReadCheck, { slug: 'url-shortener', quiet: true })),
          createElement(SdMarkRead, { slug: 'url-shortener', slugs }),
        ),
      ),
    );
    await settle();
    assert.deepEqual(calls, [['GET', '/api/oj/marks?mark=read', undefined]], 'one request serves every component');
    const counts = () => [...document.querySelectorAll('.sd-read-count')].map((p) => p.textContent);
    assert.deepEqual(counts(), [`1 of ${slugs.length} read`, `1 of ${slugs.length} read`]);
    assert.equal(document.querySelector('#a').textContent, 'Read');
    assert.equal(document.querySelector('#b').textContent, '');
    const box = document.querySelector('.sd-read input');
    assert.equal(box.checked, false);
    await act(async () => box.click());
    await settle();
    assert.deepEqual(calls.at(-1), ['POST', '/api/oj/marks', { target: 'sd:url-shortener', mark: 'read', on: true }]);
    assert.equal(box.checked, true);
    assert.deepEqual(counts(), [`2 of ${slugs.length} read`, `2 of ${slugs.length} read`]);
    assert.equal(document.querySelector('#b .sr-only').textContent, 'Read');
    await act(async () => box.click());
    await settle();
    assert.deepEqual(calls.at(-1)[2], { target: 'sd:url-shortener', mark: 'read', on: false });
    assert.deepEqual(counts(), [`1 of ${slugs.length} read`, `1 of ${slugs.length} read`]);

    // A failed write says so and leaves the mark as it was.
    marksApi(read, { failPost: true });
    await act(async () => box.click());
    await settle();
    assert.equal(box.checked, false);
    assert.equal(document.querySelector('.sd-read-error').textContent, 'Too many requests');
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = original;
    dom.window.close();
  }
});

test('signed out: no progress, and marking read asks to sign in', async () => {
  const dom = useDom();
  const { createRoot } = await import('react-dom/client');
  const { SdMarkRead, SdReadCount } = await import('../app/system-design/reader.tsx');
  const original = globalThis.fetch;
  marksApi(null);
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () =>
      root.render(createElement(Fragment, null, createElement(SdReadCount, { slugs }), createElement(SdMarkRead, { slug: 'framework', slugs }))),
    );
    await settle();
    assert.equal(document.querySelector('.sd-read-count'), null);
    assert.equal(document.querySelector('.sd-read input'), null);
    assert.equal(document.querySelector('.sd-read a').getAttribute('href'), '/?view=account');
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = original;
    dom.window.close();
  }
});

test('the walkthrough opens after a draft or a skip, stays open next time, and opens for a section link', async () => {
  const dom = useDom();
  const { createRoot } = await import('react-dom/client');
  const { SdTryFirst } = await import('../app/system-design/reader.tsx');
  const original = globalThis.fetch;
  marksApi(null);
  const root = createRoot(document.getElementById('root'));
  const render = (slug = 'url-shortener', userId = null) =>
    act(async () => root.render(createElement(SdTryFirst, { key: slug, slug, userId }, createElement('h2', { id: '3-api' }, 'API'))));
  const closed = () => {
    const walkthrough = document.querySelector('.sd-walkthrough');
    return walkthrough.hasAttribute('data-closed') && walkthrough.hasAttribute('inert');
  };
  const typeDraft = (value) =>
    act(async () => {
      const box = document.querySelector('.ip-try-input');
      Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(box, value);
      box.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  try {
    await render();
    await settle();
    assert.ok(closed());
    assert.ok(document.querySelector('.sd-try-brief').textContent.includes('10 minutes'));
    await typeDraft('Requirements: shorten, redirect. API: POST /links');
    const compare = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Compare'));
    await act(async () => compare.click());
    await settle();
    assert.equal(closed(), false);
    assert.equal(document.activeElement, document.querySelector('.sd-walkthrough'), 'focus moves to the walkthrough');
    assert.equal(localStorage.getItem('cswork:sd-open:url-shortener'), '1');

    // Opened before: open straight away. Another chapter starts closed.
    await act(async () => root.render(createElement('div')));
    await render();
    await settle();
    assert.equal(closed(), false);
    await render('rate-limiter');
    await settle();
    assert.ok(closed());

    // A link to one of its sections opens it.
    await act(async () => {
      location.hash = '#3-api';
      window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
      await new Promise((r) => setTimeout(r, 10));
    });
    assert.equal(closed(), false);

    // A chapter the signed-in learner marked read is open.
    location.hash = '';
    localStorage.clear();
    await act(async () => root.render(createElement('div')));
    marksApi(new Set(['sd:news-feed']));
    await render('news-feed', 'me');
    await settle();
    assert.equal(closed(), false);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = original;
    dom.window.close();
  }
});

test("a guest's draft stays on this device and goes to the account after signing in", async () => {
  const dom = useDom();
  const { createRoot } = await import('react-dom/client');
  const { SdTryFirst } = await import('../app/system-design/reader.tsx');
  const original = globalThis.fetch;
  marksApi(null);
  const root = createRoot(document.getElementById('root'));
  const render = (userId) =>
    act(async () => root.render(createElement(SdTryFirst, { key: String(userId), slug: 'url-shortener', userId }, 'body')));
  const box = () => document.querySelector('.ip-try-input');
  try {
    await render(null);
    await settle();
    assert.ok(document.querySelector('.ip-try-head p').textContent.includes('Kept on this device only'));
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(box(), 'Requirements: shorten');
      box().dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    assert.equal(localStorage.getItem('cswork:sd-draft:url-shortener'), 'Requirements: shorten');

    // A reload keeps it, and a drafted chapter opens.
    await act(async () => root.render(createElement('div')));
    await render(null);
    await settle();
    assert.equal(box().value, 'Requirements: shorten');
    assert.equal(document.querySelector('.sd-walkthrough').hasAttribute('inert'), false);

    // Signed in (a full page load): the account has no draft yet, so this one is saved to it.
    await act(async () => root.render(createElement('div')));
    const calls = marksApi(new Set());
    await render('me');
    await settle();
    assert.deepEqual(
      calls.find(([method]) => method === 'PUT'),
      ['PUT', '/api/oj/notes?target=sd%3Aurl-shortener%2Fdraft', { body: 'Requirements: shorten' }],
    );
    assert.equal(box().value, 'Requirements: shorten');
    assert.equal(localStorage.getItem('cswork:sd-draft:url-shortener'), null);
    assert.equal(localStorage.getItem('cswork:note-draft:me:sd:url-shortener/draft'), null, 'saved, so no local copy is left');
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = original;
    dom.window.close();
  }
});
