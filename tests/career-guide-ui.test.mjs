// The career guide (/guide) and the resume review form: every chapter exists in both languages
// with working site links and no employer names or salary figures, pages render accessibly on
// the server, and the client form sends pasted text only when asked and shows the review.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const react = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
const mocks = {
  'next/headers': `export const cookies = async () => ({ get: () => undefined });`,
  'next/link': `import React from ${JSON.stringify(react)};export default function Link({ href, prefetch, children, ...rest }) { return React.createElement('a', { href, ...rest }, children); }`,
};
register(
  `data:text/javascript,${encodeURIComponent(`const mocks=${JSON.stringify(mocks)};
export async function resolve(s,c,n){if(mocks[s])return {url:'mock:'+s,shortCircuit:true};return n(s,c);}
export async function load(u,c,n){
  if(u.startsWith('mock:'))return {format:'module',source:mocks[u.slice(5)],shortCircuit:true};
  if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};
  return n(u,c);}`)}`,
  import.meta.url,
);

const { GUIDE_CHAPTERS, SEASON, guideChapter } = await import('../lib/career-guide.ts');
const { GUIDE_BODIES } = await import('../lib/content/career-guide.ts');
const { GuideIndexView, GuideChapterView } = await import('../app/guide/views.tsx');
const { SITEMAP_STATIC_ENTRIES } = await import('../lib/seo.ts');

const render = (element) => new JSDOM(`<main>${renderToStaticMarkup(element)}</main>`).window.document;
const CJK = /[一-鿿]/;
const SITE_LINKS = new Set(['/?view=stories', '/?view=mock', '/acm-io', '/flowchart', '/topics', '/mock-interview', '/career/jd', '/career/visa-timeline', '/career/offers']);

test('every chapter has a body in both languages, with matching sections and live site links', () => {
  assert.equal(GUIDE_CHAPTERS.length, 8);
  assert.deepEqual(Object.keys(GUIDE_BODIES).sort(), GUIDE_CHAPTERS.map((c) => c.slug).sort());
  for (const { slug, title, summary } of GUIDE_CHAPTERS) {
    const { zh, en } = GUIDE_BODIES[slug];
    assert.ok(CJK.test(title[0]) && !CJK.test(title[1]) && CJK.test(summary[0]) && !CJK.test(summary[1]), slug);
    assert.ok(zh.length > 400 && en.length > 600, slug);
    const headings = (body) => body.match(/^## /gm)?.length ?? 0;
    assert.equal(headings(zh), headings(en), `${slug} sections`);
    // English carries Chinese only where it names the China campus rounds.
    assert.ok(!CJK.test(en.replace(/\((?:提前批|秋招|春招)\)/g, '')), `${slug} en has Chinese`);
    for (const body of [zh, en])
      for (const [, link] of body.matchAll(/\]\(([^)]+)\)/g))
        assert.ok(
          SITE_LINKS.has(link) || (link.startsWith('/guide/') && guideChapter(link.slice(7))),
          `${slug}: ${link}`,
        );
  }
});

test('the guide names no employer and quotes no salary figure', () => {
  const all = Object.values(GUIDE_BODIES).flatMap((b) => [b.zh, b.en]).join('\n');
  for (const name of ['google', 'alphabet', 'meta', 'facebook', 'amazon', 'microsoft', 'apple', 'netflix', 'uber', 'airbnb', 'tiktok', 'bytedance', '谷歌', '字节', '腾讯', '阿里'])
    assert.ok(!new RegExp(`\\b${name}\\b`, 'i').test(all), name);
  assert.ok(!/[$¥€£]\s?\d/.test(all));
  assert.ok(!/\d+\s?k\s?(?:\/|per)\s?(?:yr|year)/i.test(all));
  // The visa chapter opens with its disclaimer in both languages.
  assert.ok(GUIDE_BODIES.visa.zh.startsWith('**以下是一般性信息，不是法律意见'));
  assert.ok(GUIDE_BODIES.visa.en.startsWith('**This is general information, not legal advice'));
});

test('the index lists every chapter, the season and the resume review, in both languages', () => {
  for (const zh of [true, false]) {
    const doc = render(createElement(GuideIndexView, { zh }));
    assert.equal(doc.querySelectorAll('h1').length, 1);
    const links = [...doc.querySelectorAll('.guide-chapters a')];
    assert.equal(links.length, GUIDE_CHAPTERS.length);
    assert.ok(links.every((a, i) => a.getAttribute('href') === `/guide/${GUIDE_CHAPTERS[i].slug}`));
    assert.ok(links.every((a) => a.querySelector('.guide-no').getAttribute('aria-hidden') === 'true'));
    assert.equal(doc.querySelectorAll('.guide-season li').length, SEASON.length);
    assert.ok(doc.querySelector('.guide-review-cta a').getAttribute('href') === '/career/resume/builder#resume-check');
    assert.ok(doc.querySelector('.guide-review-cta a[href="/career/visa-timeline"]') !== null);
    assert.ok(doc.querySelector('.guide-review-cta a[href="/ai-assisted"]') !== null);
    // Complementary landmarks, each named in the page's language.
    const asides = [...doc.querySelectorAll('aside')].map((a) => a.getAttribute('aria-label'));
    assert.deepEqual(
      asides,
      zh
        ? ['试试简历检查', '身份时间线计算器', 'AI 辅助编程轮练习']
        : ['Try the resume check', 'Visa timeline calculator', 'AI-assisted round practice'],
    );
    const [crumbs, list] = [...doc.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent));
    assert.equal(crumbs['@type'], 'BreadcrumbList');
    assert.equal(list.itemListElement.length, 8);
    assert.ok(list.itemListElement[7].url === 'https://cswork.org/guide/visa');
  }
});

test('a chapter renders its body with labelled scroll regions, a table of contents and neighbours', () => {
  for (const zh of [true, false]) {
    const doc = render(createElement(GuideChapterView, { chapter: guideChapter('timeline'), zh }));
    assert.equal(doc.querySelector('h1').textContent, guideChapter('timeline').title[zh ? 0 : 1]);
    const table = doc.querySelector('.guide-table');
    assert.ok(table !== null && table.getAttribute('role') === 'region' && table.getAttribute('tabindex') === '0');
    assert.ok(!!table.getAttribute('aria-label'));
    assert.equal(table.querySelectorAll('tbody tr').length, 6);
    assert.ok(doc.querySelector('.guide-body a[href="/guide/resume"]') !== null);
    assert.equal(doc.querySelectorAll('.guide-toc a').length, 8);
    assert.ok(doc.querySelector('.guide-toc a[aria-current="page"]').getAttribute('href') === '/guide/timeline');
    assert.ok(doc.querySelector('a[rel="prev"]') === null);
    assert.ok(doc.querySelector('a[rel="next"]').getAttribute('href') === '/guide/resume');
    const article = JSON.parse(doc.querySelectorAll('script[type="application/ld+json"]')[1].textContent);
    assert.equal(article['@type'], 'Article');
  }
  const resume = render(createElement(GuideChapterView, { chapter: guideChapter('resume'), zh: false }));
  const pre = resume.querySelector('.guide-body pre');
  assert.ok(pre !== null && pre.getAttribute('tabindex') === '0' && pre.textContent.includes('EDUCATION'));
  const last = render(createElement(GuideChapterView, { chapter: guideChapter('visa'), zh: true }));
  assert.ok(last.querySelector('.guide-adjacent a:last-child').getAttribute('href') === '/career/resume/builder#resume-check');
});

test('the sitemap lists the guide and the resume review', () => {
  const paths = new Set(SITEMAP_STATIC_ENTRIES.map((e) => e.path));
  for (const path of ['/guide', '/career/resume', '/career/visa-timeline', '/career/offers', '/career/templates', '/career/jobs/calendar', ...GUIDE_CHAPTERS.map((c) => `/guide/${c.slug}`)]) assert.ok(paths.has(path), path);
});

test('no nav or timeline link points at the H-1B ranking while its data is unbuilt', async () => {
  const { H1B } = await import('../lib/server/h1b.ts');
  const { GuideShell } = await import('../app/guide/shell.tsx');
  const { default: VisaTimelinePage } = await import('../app/career/visa-timeline/page.tsx');
  const shell = renderToStaticMarkup(createElement(GuideShell, { zh: false, children: null }));
  const visa = renderToStaticMarkup(await VisaTimelinePage());
  assert.match(shell, /href="\/career\/tracker"/);
  for (const href of ['/career/offers', '/career/jobs/calendar', '/career/resume/builder#resume-check', '/projects', '/english']) assert.ok(shell.includes(`href="${href}"`), href);
  for (const html of [shell, visa]) assert.equal(html.includes('href="/career/h1b"'), H1B.fiscalYears.length > 0);
});

test('the resume form waits for enough text, sends it once, and shows the review', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://cswork.test/career/resume' });
  for (const name of ['window', 'document', 'HTMLElement', 'HTMLTextAreaElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'localStorage'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const sent = [];
  let usage = { status: 200, body: { resume: 2, bonus: 0 } };
  const review = {
    summary: 'Solid base.',
    impact: ['Add a number to the payments bullet.'],
    verbs: [],
    keywords: { missing: ['Kubernetes'], present: ['Go'] },
    rewrites: [{ before: 'Worked on payments', after: 'Cut payment latency by [X%]', why: 'Shows the result.' }],
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).endsWith('/ai/usage')) return Response.json(usage.body, { status: usage.status });
    sent.push(JSON.parse(init.body));
    return Response.json({ review, remaining: 1, limit: 2, bonus: 0 });
  };
  const { createRoot } = await import('react-dom/client');
  const { ResumeReview } = await import('../components/resume-review.tsx');
  const root = createRoot(document.getElementById('root'));
  const type = async (selector, value) => {
    const field = document.querySelector(selector);
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value').set;
    await act(async () => {
      setter.call(field, value);
      field.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
  };
  try {
    await act(async () => root.render(createElement(ResumeReview, { zh: false })));
    const submit = () => document.querySelector('.resume-actions button');
    assert.ok(document.querySelector('.resume-actions small').textContent === '2 reviews left today');
    assert.equal(submit().disabled, true);
    await type('#resume-text', 'x'.repeat(40));
    assert.equal(submit().disabled, true);
    await type('#resume-text', `Jane Doe\n${'Worked on payments. '.repeat(10)}`);
    await type('#resume-role', 'Backend intern');
    assert.equal(submit().disabled, false);
    assert.equal(sent.length, 0);
    await act(async () => submit().click());
    assert.equal(sent.length, 1);
    assert.deepEqual(Object.keys(sent[0]).sort(), ['job', 'locale', 'resume', 'role']);
    assert.equal(sent[0].role, 'Backend intern');
    const result = document.querySelector('.resume-result');
    assert.ok(result !== null);
    assert.ok(document.activeElement === result);
    assert.equal(result.querySelector('del').textContent, 'Worked on payments');
    assert.equal(result.querySelector('ins').textContent, 'Cut payment latency by [X%]');
    assert.equal(result.querySelector('.resume-keywords.is-missing li').textContent, 'Kubernetes');
    assert.ok(document.querySelector('.resume-actions small').textContent === '1 review left today');
    // Nothing of the resume is kept in the browser.
    assert.equal(localStorage.length, 0);
    await act(async () => root.unmount());
    usage = { status: 401, body: { error: 'Please sign in first' } };
    const again = createRoot(document.getElementById('root'));
    await act(async () => again.render(createElement(ResumeReview, { zh: true })));
    assert.ok(document.querySelector('.resume-off a').getAttribute('href') === '/?view=account');
    await act(async () => again.unmount());
  } finally {
    globalThis.fetch = realFetch;
  }
});
