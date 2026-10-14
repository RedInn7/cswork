import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  canonicalCompany,
  oaCompanyName,
  oaProblemPath,
} from '../lib/oa-company-brands';
import { oaStatementMarkdown } from '../lib/oa-verified-statement';
import { breadcrumbJsonLd, oaPageTitle } from '../lib/seo';
import { hiddenCompanies } from '../lib/server/env';
import { createOaLibrary } from '../lib/server/oa-library';

const catalog = () =>
  JSON.parse(readFileSync('content/oa-master/catalog.json', 'utf8'));

void test('aliased catalog slugs fold into one company, Other last, and links use the canonical slug', () => {
  assert.equal(canonicalCompany('barclay'), 'barclays');
  assert.equal(canonicalCompany('sig'), 'susquehanna-international-group');
  assert.equal(canonicalCompany('amazon-mern'), 'amazon');
  assert.equal(canonicalCompany('ibm-frontend'), 'ibm');
  assert.equal(canonicalCompany('meta'), 'meta');
  assert.equal(
    oaProblemPath('amazon-mern', 'oa-amazon-mern-2'),
    '/oa/amazon/oa-amazon-mern-2',
  );
  assert.equal(oaCompanyName('unknown', 'Unknown', 'zh'), '其他');
  assert.equal(oaCompanyName('unknown', 'Unknown', 'en'), 'Other');
  const source = catalog();
  const library = createOaLibrary(source);
  const companies = library.companies();
  const slugs = companies.map((company) => company.slug);
  for (const alias of ['barclay', 'sig', 'amazon-mern', 'ibm-frontend'])
    assert(!slugs.includes(alias), alias);
  assert.equal(slugs.at(-1), 'unknown');
  const raw = (slug: string) =>
    source.companies.find((c: { slug: string }) => c.slug === slug).count;
  const amazon = companies.find((company) => company.slug === 'amazon')!;
  assert.equal(amazon.count, raw('amazon') + raw('amazon-mern'));
  // The sidebar total and the header total count the same problems.
  assert.equal(
    companies.reduce((sum, company) => sum + company.count, 0),
    library.list(new URLSearchParams()).total,
  );
  const barclays = library.list(new URLSearchParams('company=barclay'));
  assert.equal(barclays.total, raw('barclays') + raw('barclay'));
  assert(barclays.items.every((item) => item.companySlug === 'barclays'));
  assert.equal(library.problem('oa-sig-1')?.company.name, 'Susquehanna International Group');
  assert.equal(library.company('sig'), undefined);
  const ready = new Set(['oa-amazon-1', 'oa-amazon-mern-2']);
  assert.equal(
    library.companies(ready).find((company) => company.slug === 'amazon')!.ready,
    2,
  );
});

void test('OA page titles, breadcrumbs and English statement headings', () => {
  assert.equal(oaPageTitle('en', 'Amazon', 'Two Sum'), 'Amazon OA: Two Sum | CSWork');
  assert.equal(oaPageTitle('zh', 'Amazon', 'Two Sum'), 'Amazon OA 真题：Two Sum | CSWork');
  assert.equal(oaPageTitle('en', 'Amazon'), 'Amazon OA Questions & Practice | CSWork');
  assert.equal(oaPageTitle('zh'), '公司 OA 真题题库 | CSWork');
  const script = breadcrumbJsonLd([
    { name: 'OA', path: '/oa' },
    { name: '</script>', path: '/oa/amazon' },
  ]);
  assert(!script.includes('<'));
  const trail = JSON.parse(script);
  assert.equal(trail['@type'], 'BreadcrumbList');
  assert.deepEqual(
    trail.itemListElement.map((step: { position: number; item: string }) => [step.position, step.item]),
    [
      [1, 'https://cswork.org/oa'],
      [2, 'https://cswork.org/oa/amazon'],
    ],
  );
  const spec = { description: 'D', input: 'I', output: 'O', explanation: 'E' };
  const samples = [{ input: '1\n', expectedOutput: '2\n' }];
  assert.match(oaStatementMarkdown(spec, samples, 'en'), /## Input\n\nI\n\n## Output[\s\S]*## Example 1\n\nInput:[\s\S]*## Example notes\n\nE$/);
  assert.match(oaStatementMarkdown(spec, samples), /## 输入格式[\s\S]*## 样例 1\n\n输入：/);
});

void test('sitemap entries and pages leave out hidden companies and their merged aliases', () => {
  const library = createOaLibrary(catalog());
  const at = Date.UTC(2026, 9, 1);
  const ready = new Map([
    ['oa-meta-1', { updatedAt: at }],
    ['oa-amazon-1', { updatedAt: at + 1000 }],
  ]);
  process.env.HIDDEN_COMPANIES = 'google,amazon';
  try {
    assert(hiddenCompanies().has('amazon-mern'));
    const entries = library.sitemapEntries(ready);
    const paths = entries.map((entry) => entry.path);
    assert.equal(paths[0], '/oa');
    assert(paths.includes('/oa/meta'));
    assert(paths.includes('/oa/meta/oa-meta-1'));
    assert(!paths.some((path) => /^\/oa\/(?:google|amazon)(?:\/|$)|amazon-mern/.test(path)));
    assert(!paths.some((path) => /\/oa\/(?:barclay|sig|ibm-frontend)(?:\/|$)/.test(path)));
    assert.equal(new Set(paths).size, paths.length);
    const updated = new Map(entries.map((entry) => [entry.path, entry.updatedAt]));
    assert.equal(updated.get('/oa/meta/oa-meta-1'), new Date(at).toISOString());
    assert.equal(updated.get('/oa/meta'), new Date(at).toISOString());
    // A hidden company's update time does not leak into the index lastmod.
    assert.equal(updated.get('/oa'), new Date(at).toISOString());
    assert.equal(updated.get('/oa/meta/oa-meta-2'), null);
    assert.equal(library.problem('oa-google-1'), undefined);
    assert.equal(library.problem('oa-amazon-mern-2'), undefined);
    assert.equal(library.company('google'), undefined);
  } finally {
    delete process.env.HIDDEN_COMPANIES;
  }
  assert(library.sitemapEntries().some((entry) => entry.path === '/oa/google'));
});
