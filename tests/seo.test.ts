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
  });
  assert.equal(metadata.alternates?.languages, undefined);
  assert.throws(() =>
    seoMetadata({ title: 'x', description: 'x', path: '//other.example/' }),
  );
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
  for (const path of ['/projects', '/projects/rate-limiter', '/english', '/english/self-intro', '/frontend', '/frontend/js/debounce', '/system-design', '/interview-platforms', '/oa/sims', '/career/negotiation', '/oa/aptitude', '/topics/glossary', '/topics/print', '/learn/os', '/learn/network'])
    assert.ok(paths.includes(path), path);
  assert.equal(paths.filter((p) => p.startsWith('/english/')).length, 12);
  assert.equal(paths.filter((p) => p.startsWith('/frontend/js/')).length, 40);
  assert.ok(!paths.some((p) => /\/accept$|^\/feeds\/|^\/career\/(contacts|tracker|intern|resume\/review)|^\/review-sheet/.test(p)));
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
