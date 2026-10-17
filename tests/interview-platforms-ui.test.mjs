// /interview-platforms: every platform has a cell for every rule, sourced from its own domain,
// practice links that exist on the site, no employer names, and one page in each language.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';

const react = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
const mocks = {
  'next/headers': `export const cookies = async () => ({ get: () => (globalThis.__locale ? { value: globalThis.__locale } : undefined) });`,
  'next/link': `import React from ${JSON.stringify(react)};export default function Link({ href, prefetch, children, ...rest }) { return React.createElement('a', { href, ...rest }, children); }`,
  'next/navigation': `export const usePathname = () => '/'; export const useSearchParams = () => new URLSearchParams();`,
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

const { PLATFORMS, ROWS } = await import('../lib/content/interview-platforms.ts');
const { TEMPLATES } = await import('../lib/mock-interview.ts');
const { default: InterviewPlatformsPage } = await import('../app/interview-platforms/page.tsx');

const CJK = /[一-鿿]/;
const PRACTICE = new Set(['/?view=mock', '/?view=mock&rules=codility', '/oa/ica', '/oa/mcq', '/playground', '/?view=problems']);
const render = async (locale) => {
  globalThis.__locale = locale;
  return new JSDOM(renderToStaticMarkup(await InterviewPlatformsPage())).window.document;
};

test('every platform fills every rule; facts and employer settings cite the platform’s own pages', () => {
  assert.deepEqual(
    PLATFORMS.map((p) => p.id),
    ['hackerrank', 'codesignal', 'codility', 'coderpad', 'karat', 'hackerearth'],
  );
  assert.equal(ROWS.length, 7);
  const own = (p, url) => {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && (hostname === p.domain || hostname.endsWith(`.${p.domain}`));
  };
  for (const p of PLATFORMS) {
    assert.ok(own(p, p.languagesSrc), `${p.id} languages`);
    assert.deepEqual(Object.keys(p.cells).sort(), ROWS.map((r) => r.key).sort(), p.id);
    for (const [key, cell] of Object.entries(p.cells)) {
      if (cell.k === 'none') {
        assert.deepEqual(Object.keys(cell), ['k'], `${p.id}.${key}: no text or source when not stated`);
        continue;
      }
      assert.ok(['fact', 'employer'].includes(cell.k), `${p.id}.${key}`);
      assert.ok(cell.src.length > 0 && cell.src.every((u) => own(p, u)), `${p.id}.${key} sources`);
      assert.ok(CJK.test(cell.zh) && !CJK.test(cell.en), `${p.id}.${key} languages`);
    }
  }
});

test('practice links point at real modes; the interview template exists', () => {
  const ids = new Set(TEMPLATES.map((t) => t.id));
  for (const p of PLATFORMS) {
    assert.ok(p.practice.length > 0, p.id);
    for (const { href, zh, en } of p.practice) {
      const template = href.match(/^\/\?view=mock-interview&template=([\w-]+)$/)?.[1];
      assert.ok(PRACTICE.has(href) || ids.has(template), `${p.id}: ${href}`);
      assert.ok(CJK.test(zh) && !CJK.test(en), href);
    }
  }
  assert.ok(PLATFORMS.find((p) => p.id === 'karat').practice.some((x) => x.href.includes('template=')));
});

test('the page names no employer, in both languages', async () => {
  for (const locale of ['zh', 'en']) {
    const text = (await render(locale)).body.textContent;
    // The career guide's list (tests/career-guide-ui.test.mjs).
    for (const name of ['google', 'alphabet', 'meta', 'facebook', 'amazon', 'microsoft', 'apple', 'netflix', 'uber', 'airbnb', 'tiktok', 'bytedance', '谷歌', '字节', '腾讯', '阿里'])
      assert.ok(!new RegExp(`\\b${name}\\b`, 'i').test(text), `${locale}: ${name}`);
  }
});

test('one table per language: six platform columns, every cell filled, a practice link in each column', async () => {
  for (const locale of ['zh', 'en']) {
    const doc = await render(locale);
    assert.equal(doc.querySelectorAll('h1').length, 1);
    assert.equal(doc.documentElement.querySelector('.public-library').getAttribute('lang'), locale === 'zh' ? 'zh-CN' : 'en');
    const table = doc.querySelector('table.platform-rules');
    const heads = [...table.querySelectorAll('thead th[scope="col"]')].slice(1);
    assert.deepEqual(
      heads.map((th) => th.firstChild.textContent),
      PLATFORMS.map((p) => p.name),
    );
    assert.ok(heads.every((th) => th.querySelector('a[rel="noopener noreferrer"]')));
    const rows = [...table.querySelectorAll('tbody tr')];
    assert.equal(rows.length, ROWS.length + 1);
    for (const tr of rows) {
      assert.equal(tr.querySelectorAll('th[scope="row"]').length, 1);
      const cells = [...tr.querySelectorAll('td')];
      assert.equal(cells.length, PLATFORMS.length);
      assert.ok(cells.every((td) => td.textContent.trim()), tr.firstChild.textContent);
    }
    const practice = [...rows.at(-1).querySelectorAll('td')];
    assert.ok(practice.every((td, i) => td.querySelectorAll('a').length === PLATFORMS[i].practice.length));
    // External sources never leak the referrer; every source link names its platform and rule.
    const sources = [...table.querySelectorAll('tbody a[href^="https://"]')];
    assert.equal(sources.length, PLATFORMS.flatMap((p) => Object.values(p.cells).flatMap((c) => c.src ?? [])).length);
    assert.ok(sources.every((a) => a.getAttribute('rel') === 'noopener noreferrer' && a.getAttribute('aria-label')));
    const text = doc.body.textContent;
    assert.match(text, locale === 'zh' ? /由雇主设置/ : /Set by the employer/);
    assert.match(text, locale === 'zh' ? /官方未说明/ : /Not stated officially/);
    assert.match(text, locale === 'zh' ? /2026 年 10 月.*以邀请邮件和考试说明为准/ : /October 2026.*invitation email and the test instructions always win/);
    assert.equal(CJK.test(text), locale === 'zh');
  }
});
