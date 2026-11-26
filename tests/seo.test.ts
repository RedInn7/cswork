import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  seoMetadata,
  sitemapChunks,
  sitemapIndexXml,
  sitemapXml,
  sitemapPageCount,
  sitemapLibraryRange,
  SITEMAP_URL_LIMIT,
  SITEMAP_STATIC_ENTRIES,
  xmlResponse,
  workspaceTitle,
  SEO_HOME,
} from '../lib/seo';
import { languagePath, preferredLanguage, splitLanguagePath } from '../lib/language';
import { GET as robots } from '../app/robots.txt/route';
import { sitemapStatics } from '../lib/server/sitemap';

test('page metadata uses one production canonical and matching social previews', () => {
  const metadata = seoMetadata({
    title: 'Interview experiences · CSWork',
    description: 'Company interviews and preparation notes.',
    path: '/library?type=experience&page=2#results',
  });
  assert.equal(metadata.metadataBase?.toString(), 'https://cswork.org/');
  assert.equal(
    metadata.alternates?.canonical,
    'https://cswork.org/library?type=experience&page=2',
  );
  assert.deepEqual(metadata.openGraph, {
    title: metadata.title,
    description: metadata.description,
    url: metadata.alternates?.canonical,
    siteName: 'CSWork',
    type: 'website',
    locale: 'zh_CN',
  });
  assert.throws(() =>
    seoMetadata({ title: 'x', description: 'x', path: '//other.example/' }),
  );
});

test('each language is its own canonical URL, linked to the others by hreflang', () => {
  const page = { title: 'OA', description: 'OA questions.' };
  const en = seoMetadata({ ...page, path: '/oa/amazon?page=2', language: 'en' });
  assert.equal(en.alternates?.canonical, 'https://cswork.org/en/oa/amazon?page=2');
  assert.deepEqual(en.alternates?.languages, {
    'zh-Hans': 'https://cswork.org/oa/amazon?page=2',
    'zh-Hant': 'https://cswork.org/zh-Hant/oa/amazon?page=2',
    en: 'https://cswork.org/en/oa/amazon?page=2',
    'x-default': 'https://cswork.org/en/oa/amazon?page=2',
  });
  // Japanese has no copy of its own here: the English page is the canonical one.
  const ja = seoMetadata({ ...page, path: '/oa/amazon', language: 'ja' });
  assert.equal(ja.alternates?.canonical, 'https://cswork.org/en/oa/amazon');
  // A page translated into Japanese only: /ja is its own page, /ko still reads the English one.
  const some = { ...page, path: '/oa/amazon/oa-amazon-1', localized: ['ja'] as const };
  assert.equal(seoMetadata({ ...some, language: 'ja' }).alternates?.canonical, 'https://cswork.org/ja/oa/amazon/oa-amazon-1');
  assert.equal(seoMetadata({ ...some, language: 'ko' }).alternates?.canonical, 'https://cswork.org/en/oa/amazon/oa-amazon-1');
  assert.deepEqual(Object.keys(seoMetadata(some).alternates?.languages || {}), ['zh-Hans', 'zh-Hant', 'en', 'ja', 'x-default']);
  const home = seoMetadata({ ...page, path: '/', language: 'ja', localized: true });
  assert.equal(home.alternates?.canonical, 'https://cswork.org/ja');
  assert.deepEqual(Object.keys(home.alternates?.languages || {}), [
    'zh-Hans', 'zh-Hant', 'en', 'ja', 'ko', 'vi', 'x-default',
  ]);
  assert.equal((home.alternates?.languages as Record<string, string>)['zh-Hans'], 'https://cswork.org/');
});

test('language URLs split and rebuild, and a first visit follows the browser', () => {
  assert.deepEqual(splitLanguagePath('/en/oa/amazon'), { language: 'en', path: '/oa/amazon' });
  assert.deepEqual(splitLanguagePath('/zh-Hant'), { language: 'zh-Hant', path: '/' });
  assert.deepEqual(splitLanguagePath('/oa'), { language: null, path: '/oa' });
  assert.deepEqual(splitLanguagePath('/enterprise'), { language: null, path: '/enterprise' });
  assert.equal(languagePath('zh', '/oa'), '/oa');
  assert.equal(languagePath('ko', '/'), '/ko');
  assert.equal(languagePath('en', '/?view=problem'), '/en?view=problem');
  assert.equal(preferredLanguage('en-US,en;q=0.9'), 'en');
  // Chinese anywhere in the list wins: bilingual readers with an English browser.
  assert.equal(preferredLanguage('en-US,en;q=0.9,zh-CN;q=0.8'), 'zh');
  assert.equal(preferredLanguage('zh-TW,zh;q=0.9'), 'zh-Hant');
  assert.equal(preferredLanguage('ko-KR,ko;q=0.9,en;q=0.8'), 'ko');
  assert.equal(preferredLanguage('fr-FR'), 'en');
  assert.equal(preferredLanguage(''), null);
});

test('the sitemap index lists every language, and a language shard carries its prefix', () => {
  const index = sitemapIndexXml(1, ['oa']);
  for (const loc of ['/sitemap/1', '/sitemap/oa', '/en/sitemap/1', '/en/sitemap/oa', '/zh-Hant/sitemap/oa', '/ja/sitemap/1', '/ko/sitemap/1', '/vi/sitemap/1'])
    assert.ok(index.includes(`<loc>https://cswork.org${loc}</loc>`), loc);
  assert.ok(!index.includes('/ja/sitemap/oa'));
  assert.deepEqual(sitemapChunks([{ path: '/' }, { path: '/oa' }], 'en')[0], [
    '<url><loc>https://cswork.org/en</loc></url>',
    '<url><loc>https://cswork.org/en/oa</loc></url>',
  ]);
});


test('workspace tab titles name the view and keep the home title on the landing page', () => {
  assert.equal(workspaceTitle('zh'), SEO_HOME.zh.title);
  assert.equal(workspaceTitle('en'), SEO_HOME.en.title);
  assert.equal(workspaceTitle('zh', '两数之和'), '两数之和 · CSWork');
  assert.equal(workspaceTitle('en', 'Problem Bank'), 'Problem Bank · CSWork');
});

test('sitemaps escape query URLs and use actual valid update dates only', () => {
  const chunks = sitemapChunks([
    { path: '/library?type=guide&page=2', updatedAt: '2026-10-11T01:02:03Z' },
    { path: '/privacy', updatedAt: 'not a date' },
    { path: '/' },
  ]);
  const xml = sitemapXml(chunks[0]);
  assert.match(xml, /https:\/\/cswork.org\/library\?type=guide&amp;page=2/);
  assert.match(xml, /<lastmod>2026-10-11T01:02:03.000Z<\/lastmod>/);
  assert.equal((xml.match(/<lastmod>/g) || []).length, 1);
  assert.match(xml, /<url><loc>https:\/\/cswork.org\/privacy<\/loc><\/url>/);
});

test('large libraries are fully partitioned instead of silently truncated', () => {
  const entries = Array.from({ length: SITEMAP_URL_LIMIT + 1 }, (_, index) => ({
    path: `/library/guide/example-${index}`,
  }));
  const chunks = sitemapChunks(entries);
  assert.deepEqual(
    chunks.map((chunk) => chunk.length),
    [SITEMAP_URL_LIMIT, 1],
  );
  assert.match(
    sitemapXml(chunks[1]),
    new RegExp(`example-${SITEMAP_URL_LIMIT}<`),
  );
  const index = sitemapIndexXml(chunks.length);
  assert.match(index, /<sitemapindex /);
  assert.match(index, /https:\/\/cswork.org\/sitemap\/1/);
  assert.match(index, /https:\/\/cswork.org\/sitemap\/2/);
});

test('database sitemap batches account for static pages without gaps or overlaps', () => {
  assert.equal(sitemapPageCount(0), 1);
  const fixed = SITEMAP_STATIC_ENTRIES.length;
  assert.equal(sitemapPageCount(SITEMAP_URL_LIMIT - fixed), 1);
  assert.equal(sitemapPageCount(SITEMAP_URL_LIMIT - fixed + 1), 2);
  const first = sitemapLibraryRange(1);
  const second = sitemapLibraryRange(2);
  const third = sitemapLibraryRange(3);
  assert.deepEqual(first, { offset: 0, limit: SITEMAP_URL_LIMIT - fixed });
  assert.equal(second.offset, first.offset + first.limit);
  assert.equal(third.offset, second.offset + second.limit);
});

test('sitemap page 1 adds the content-built pages once, and no downloads, feeds or private pages', () => {
  const paths = sitemapStatics().map((entry) => entry.path);
  assert.equal(new Set(paths).size, paths.length, 'no page twice');
  for (const path of ['/interview-platforms', '/oa/sims', '/career/negotiation', '/oa/aptitude', '/topics/glossary', '/topics/print'])
    assert.ok(paths.includes(path), path);
  // Taken down: beginner courses, resume projects, skill certification, the system design course.
  assert.ok(!paths.some((p) => /^\/(learn|projects|certify|system-design)(\/|$)/.test(p)));
  assert.ok(!paths.some((p) => /\/accept$|^\/feeds\/|^\/career\/(contacts|tracker|intern|resume\/review)|^\/review-sheet|^\/(english|mock-interview)(\/|$)/.test(p)));
});

test('robots permits reading page noindex directives and names the sitemap', async () => {
  const response = robots();
  assert.equal(
    response.headers.get('content-type'),
    'text/plain; charset=utf-8',
  );
  assert.equal(
    await response.text(),
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /api/',
      '',
      'Sitemap: https://cswork.org/sitemap.xml',
      '',
    ].join('\n'),
  );
  assert.equal(
    xmlResponse('<urlset/>').headers.get('content-type'),
    'application/xml; charset=utf-8',
  );
});
