// The beginner crash course pages (/learn, /learn/<course>, /learn/<course>/<chapter>), the course
// star rating widget, and the certificate link once the last chapter is marked read.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
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
  if(u.endsWith('.css'))return {format:'module',source:'export default {}',shortCircuit:true};
  return n(u,c);}`)}`,
  import.meta.url,
);

const parse = (html) => new JSDOM(`<main>${html}</main>`).window.document;
const settle = () => act(async () => new Promise((r) => setTimeout(r, 10)));
function useDom() {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/learn/big-o' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'navigator', 'location'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
}

test('the index, a course and a lesson: links, numbering, quiz, practice and the reader', async () => {
  const { default: Index } = await import('../app/learn/page.tsx');
  const { default: Course } = await import('../app/learn/[course]/page.tsx');
  const { default: Chapter } = await import('../app/learn/[course]/[slug]/page.tsx');
  globalThis.__locale = 'zh';
  let doc = parse(renderToStaticMarkup(await Index()));
  assert.deepEqual(
    [...doc.querySelectorAll('.learn-courses a')].map((a) => a.getAttribute('href')),
    ['/learn/big-o', '/learn/python', '/learn/cpp', '/learn/java', '/learn/go', '/learn/sql'],
  );
  // Reading time: each course's total on the index, each lesson's and the total on the course page.
  assert.match(doc.querySelector('.learn-courses .sd-sheet-no').textContent, /^\d+ 节 · 约 \d+ 分钟$/);
  doc = parse(renderToStaticMarkup(await Course({ params: Promise.resolve({ course: 'big-o' }) })));
  assert.equal(doc.querySelector('h1').textContent, 'Big-O 与数据结构速成课');
  assert.match(doc.querySelector('.sd-total').textContent, /^全部读完约 \d+ 分钟$/);
  const sheets = [...doc.querySelectorAll('.sd-sheets a')];
  assert.equal(sheets.length, 10);
  assert.match(sheets[0].querySelector('.sd-sheet-meta').textContent, /^约 \d+ 分钟 · \d+ 道测验 · \d+ 道练习/);
  assert.equal(sheets[0].getAttribute('href'), '/learn/big-o/complexity');
  assert.equal(sheets[9].querySelector('.sd-sheet-no').textContent, '第 10 节');
  await assert.rejects(Course({ params: Promise.resolve({ course: 'nope' }) }), { digest: 'NEXT_NOT_FOUND' });
  await assert.rejects(Chapter({ params: Promise.resolve({ course: 'python', slug: 'heaps' }) }), { digest: 'NEXT_NOT_FOUND' });

  globalThis.__locale = 'en';
  doc = parse(renderToStaticMarkup(await Chapter({ params: Promise.resolve({ course: 'big-o', slug: 'heaps' }) })));
  assert.equal(doc.querySelector('h1').textContent, 'Heaps');
  assert.equal(doc.querySelector('.sd-sheet-no').textContent, 'Lesson 6 of 10');
  const ids = [...doc.querySelectorAll('.public-library-prose h2[id]')].map((h) => `#${h.id}`);
  assert.deepEqual(
    [...doc.querySelectorAll('.sd-toc a')].map((a) => a.getAttribute('href')),
    [...ids, '#sd-quiz-title', '#learn-practice-title'],
  );
  assert.ok(doc.getElementById('sd-quiz-title') && doc.getElementById('learn-practice-title'));
  assert.deepEqual(
    [...doc.querySelectorAll('.learn-practice a')].map((a) => a.getAttribute('href')),
    ['/?view=problem&problem=lc-1338', '/?view=problem&problem=lc-378', '/?view=problem&problem=lc-767'],
  );
  // Fresh practice, not the lesson's worked examples: just the problem number.
  assert.deepEqual(
    [...doc.querySelectorAll('.learn-practice li span')].map((span) => span.textContent),
    ['LeetCode 1338', 'LeetCode 378', 'LeetCode 767'],
  );
  assert.ok(doc.querySelector('figure.course-diagram'), 'the heap diagram draws in the browser');
  const outline = [...doc.querySelectorAll('.sd-outline a')];
  assert.equal(outline.length, 10);
  assert.deepEqual(outline.filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.textContent), ['Heaps']);
  assert.ok(doc.querySelector('.sd-read input[type="checkbox"]'));
  // The last lesson points on to the skill exams.
  doc = parse(renderToStaticMarkup(await Chapter({ params: Promise.resolve({ course: 'python', slug: 'pitfalls' }) })));
  assert.equal(doc.querySelector('.sd-pager a[href="/certify"]').textContent, 'FinishedTake a skill exam');

  // A SQL lesson practises on the SQL track: its links open the track's topics and patterns, no homework list.
  doc = parse(renderToStaticMarkup(await Chapter({ params: Promise.resolve({ course: 'sql', slug: 'joins' }) })));
  assert.equal(doc.querySelector('.learn-practice'), null);
  assert.ok(![...doc.querySelectorAll('.sd-toc a')].some((a) => a.getAttribute('href') === '#learn-practice-title'));
  assert.deepEqual(
    [...doc.querySelectorAll('.public-library-prose a')].map((a) => a.getAttribute('href')),
    [
      '/?view=problems&library=sql#sql-group-joins',
      '/?view=problems&library=sql&pattern=anti-join',
      '/?view=problems&library=sql&pattern=self-join',
    ],
  );
  assert.ok(doc.querySelector('.public-library-prose pre code.language-sql'), 'run blocks render as SQL code');
  doc = parse(renderToStaticMarkup(await Course({ params: Promise.resolve({ course: 'sql' }) })));
  assert.match(doc.querySelector('.sd-sheet-meta').textContent, /^~\d+ min · 3-question quiz$/);
  doc = parse(renderToStaticMarkup(await Course({ params: Promise.resolve({ course: 'cpp' }) })));
  assert.match(doc.querySelector('.sd-sheet-meta').textContent, /^~\d+ min · 3-question quiz · 3 problems$/);
});

test('marking the last chapter read shows the course certificate', async () => {
  useDom();
  const read = new Set(['sd:python/containers']);
  globalThis.fetch = async (url, init = {}) => {
    if (init.method === 'POST') {
      const d = JSON.parse(init.body);
      read.add(d.target);
      return Response.json({ ...d, certificate: read.size === 2 ? 'CertCourse000001' : null });
    }
    return Response.json({ items: [...read].map((target) => ({ target, mark: 'read', createdAt: 1 })) });
  };
  const { createRoot } = await import('react-dom/client');
  const { SdMarkRead } = await import('../app/system-design/reader.tsx');
  const root = createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(createElement(SdMarkRead, { slug: 'python/pitfalls', slugs: ['python/containers', 'python/pitfalls'] })),
  );
  await settle();
  assert.equal(document.querySelector('.sd-read-certificate'), null);
  // The status region is there before the notice, so the notice is announced when it lands.
  const region = document.querySelector('.sd-read [role="status"]');
  assert.equal(region?.textContent, '');
  await act(async () => document.querySelector('.sd-read input').click());
  await settle();
  assert.equal(document.querySelector('.sd-read [role="status"]'), region);
  assert.equal(region.querySelector('a').getAttribute('href'), '/certificate/CertCourse000001');
  assert.equal(document.querySelector('.sd-read-certificate a').getAttribute('href'), '/certificate/CertCourse000001');
  await act(async () => root.unmount());
});

test('course stars: the average from enough ratings, and a learner who started rates once', async () => {
  useDom();
  const calls = [];
  let rating = { avg: 4.2, count: 7, mine: null, canRate: true };
  globalThis.fetch = async (url, init = {}) => {
    calls.push([init.method ?? 'GET', String(url), init.body ? JSON.parse(init.body) : undefined]);
    if (init.method === 'POST') rating = { ...rating, count: 8, mine: JSON.parse(init.body).stars };
    return Response.json(rating);
  };
  const { createRoot } = await import('react-dom/client');
  const { CourseRating, RATING_SAVE_DELAY, RatingSummary } = await import('../components/course-rating.tsx');
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(CourseRating, { courseId: 'sd:big-o', zh: false })));
  await settle();
  assert.deepEqual(calls[0], ['GET', '/api/course-ratings?course=sd%3Abig-o', undefined]);
  const summary = document.querySelector('.course-rating-summary');
  // Screen readers ignore aria-label on a plain span: the sentence is (visually hidden) text.
  assert.equal(summary.hasAttribute('aria-label'), false);
  assert.equal(summary.querySelector('.sr-only').textContent, '4.2 out of 5 stars from 7 ratings');
  assert.equal([...summary.querySelectorAll('[aria-hidden="true"]')].map((s) => s.textContent).join(' '), '★4.2 (7)');
  const radios = [...document.querySelectorAll('.course-rating-stars input[type="radio"]')];
  // In reading order, so screen readers and arrow keys go the way the stars are drawn.
  assert.deepEqual(radios.map((r) => r.value), ['1', '2', '3', '4', '5']);
  assert.equal(document.querySelector('.course-rating-stars legend').textContent, 'Rate this course');
  // Arrowing from 5 down to 4 checks both on the way; only the pick it stops on is saved.
  await act(async () => radios[4].click());
  await act(async () => radios[3].click());
  assert.equal(calls.length, 1, 'nothing saved while the pick is moving');
  assert.equal(document.querySelector('.course-rating-stars input[value="4"]').checked, true);
  await act(async () => new Promise((r) => setTimeout(r, RATING_SAVE_DELAY + 50)));
  await settle();
  assert.deepEqual(calls.slice(1), [['POST', '/api/course-ratings', { course: 'sd:big-o', stars: 4 }]]);
  assert.equal(document.querySelector('.course-rating-stars input[value="4"]').checked, true);
  assert.equal(document.querySelector('.course-rating-status').textContent, 'Rating saved');
  assert.equal(document.querySelector('.course-rating-stars legend').textContent, 'Your rating');
  await act(async () => root.unmount());

  // Too few ratings: no average; not started: no stars to pick.
  rating = { avg: null, count: 3, mine: null, canRate: false };
  const other = createRoot(document.getElementById('root'));
  await act(async () => other.render(createElement(CourseRating, { courseId: 'algo', zh: true })));
  await settle();
  assert.equal(document.querySelector('.course-rating-summary'), null);
  assert.equal(document.querySelector('.course-rating-stars'), null);
  await act(async () => other.unmount());
  assert.equal(renderToStaticMarkup(createElement(RatingSummary, { avg: null, count: 9, zh: true })), '');
  assert.match(renderToStaticMarkup(createElement(RatingSummary, { avg: 4.6, count: 23, zh: true })), /平均 4.6 星，23 人评分/);
});

test('a course card shows its rating once: the live one beside the stars once a lesson is done', async () => {
  const { CourseList } = await import('../components/learning.tsx');
  const course = (id, has_access) => ({
    id,
    title: id,
    summary: '',
    lessons: [{ id: `${id}-1`, title: 'One', slug: 'one', position: 1 }],
    version: '1',
    has_access,
    rating_avg: 4.5,
    rating_count: 22,
  });
  const boot = {
    person: null,
    courses: [course('gomall', true), course('mit-6824', false)],
    problems: [],
    progress: [{ lesson_id: 'gomall-1', completed: true }],
    submissions: [],
    notifications: [],
    services: {},
  };
  const doc = parse(
    renderToStaticMarkup(createElement(CourseList, { boot, navigate() {}, login() {}, ask() {} })),
  );
  const cards = [...doc.querySelectorAll('.course-detail')];
  assert.equal(cards.length, 2);
  // The finished card leaves its meta line to CourseRating (which loads in the browser).
  assert.equal(cards[0].querySelectorAll('.course-meta .course-rating-summary').length, 0);
  assert.equal(cards[1].querySelectorAll('.course-meta .course-rating-summary').length, 1);
});
