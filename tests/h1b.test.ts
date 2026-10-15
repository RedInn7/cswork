// H-1B sponsor data (scripts/h1b/build.mjs → lib/content/h1b-sponsors.json → lib/server/h1b.ts):
// both USCIS column layouts sum into the same two series, aliases pick out company page
// employers only, and the pages show counts with the source and the petitions-not-people caveat.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build, matcher, normalizeName, parseCsv, readTable, records } from '../scripts/h1b/build.mjs';
import { approvalRate, H1B, h1bCompany, h1bPaths, h1bRanking, type H1bData } from '../lib/server/h1b';
import { H1bPanel } from '../app/company/h1b';

const fixture = (name: string) => readFileSync(new URL(`../fixtures/h1b/${name}`, import.meta.url));
const tables = () => [
  { file: 'fy2022-old.csv', rows: parseCsv(readTable(fixture('fy2022-old.csv'))) },
  { file: 'fy2024-new.tsv', rows: parseCsv(readTable(fixture('fy2024-new.tsv'))) },
];
const aliasFile = JSON.parse(readFileSync(new URL('../lib/content/h1b-aliases.json', import.meta.url), 'utf8')) as {
  companies: Record<string, string[]>;
};
const aliases = aliasFile.companies;

void test('names normalize past punctuation, THE and legal forms', () => {
  assert.equal(normalizeName('The MathWorks, Inc.'), 'MATHWORKS');
  assert.equal(normalizeName('Amazon.com Services LLC'), 'AMAZON COM SERVICES');
  assert.equal(normalizeName('D. E. Shaw & Co., L.P.'), 'D E SHAW');
  assert.equal(normalizeName('JPMorgan Chase Bank, N.A.'), 'JPMORGAN CHASE BANK');
  assert.equal(normalizeName('GOOGLE INC'), 'GOOGLE');
});

void test('both column layouts parse; the six new categories fold into new and continuing', () => {
  const [old, fresh] = tables();
  assert.deepEqual(records(old.rows)[0], {
    fy: 2022, employer: 'GOOGLE LLC', newApproved: 1234, newDenied: 10, contApproved: 2000, contDenied: 20,
  });
  // New = New Employment + New Concurrent + Change of Employer; continuing = Continuation + Change with Same Employer + Amended.
  assert.deepEqual(records(fresh.rows)[0], {
    fy: 2024, employer: 'GOOGLE LLC', newApproved: 1220, newDenied: 14, contApproved: 1900, contDenied: 13,
  });
  // A UTF-16 export reads the same.
  const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(readTable(fixture('fy2024-new.tsv')), 'utf16le')]);
  assert.deepEqual(parseCsv(readTable(utf16)), fresh.rows);
  assert.throws(() => records([['Name', 'Count'], ['x', '1']], 'other.csv'), /other\.csv: not an H-1B Employer Data Hub export/);
});

void test('the build sums matched employers per year, fills missing years and keeps no tax IDs', () => {
  const out = build(tables(), aliases, { updated: '2026-10-15' }) as H1bData;
  assert.deepEqual(out.fiscalYears, [2022, 2024]);
  assert.deepEqual(Object.keys(out.companies), ['amazon', 'google', 'mathworks']);
  assert.deepEqual(out.companies.google.years, [
    { fy: 2022, newApproved: 1334, newDenied: 11, contApproved: 2050, contDenied: 20 },
    { fy: 2024, newApproved: 1220, newDenied: 14, contApproved: 1900, contDenied: 13 },
  ]);
  assert.deepEqual(out.companies.amazon.years[1], { fy: 2024, newApproved: 1010, newDenied: 26, contApproved: 1450, contDenied: 12 });
  // Not one of Amazon's names, though it starts with AMAZON.
  assert.ok(!out.companies.amazon.employers.some((e: string) => e.includes('HOME HEALTH')));
  assert.deepEqual(out.companies.mathworks.years[1], { fy: 2024, newApproved: 0, newDenied: 0, contApproved: 0, contDenied: 0 });
  assert.equal(out.companies.mathworks.employers[0], 'THE MATHWORKS, INC.');
  assert.doesNotMatch(JSON.stringify(out), /1111|2222|94043|MOUNTAIN VIEW/);
  assert.equal(build(tables(), aliases, { years: 1 }).fiscalYears.join(), '2024');
  // The same year in two files would count twice.
  assert.throws(() => build([...tables(), { ...tables()[0], file: 'copy.csv' }], aliases), /FY2022 is in both/);
});

void test('aliases cover company pages only, regexes are anchored, and no name belongs to two companies', () => {
  const domains = JSON.parse(readFileSync(new URL('../lib/content/company-domains.json', import.meta.url), 'utf8')).domains;
  for (const [slug, names] of Object.entries(aliases)) {
    assert.ok(Object.hasOwn(domains, slug), `${slug} has a company page`);
    for (const n of names) if (n.startsWith('/')) assert.match(n, /^\/\^/, `${slug}: ${n} is anchored`);
  }
  matcher(aliases); // throws on a duplicate
  assert.throws(() => matcher({ a: ['Google LLC'], b: ['GOOGLE'] }), /listed for a and b/);
  const match = matcher(aliases);
  assert.equal(match('Meta Platforms, Inc.'), 'meta');
  assert.equal(match('J.P. Morgan Securities LLC'), 'jpmorgan-chase');
  assert.equal(match('Bank of America, N.A.'), null);
});

const sample: H1bData = {
  updated: '2026-10-15',
  source: 'USCIS H-1B Employer Data Hub',
  sourceUrl: 'https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub',
  fiscalYears: [2023, 2024],
  companies: {
    google: { years: [{ fy: 2023, newApproved: 10, newDenied: 0, contApproved: 5, contDenied: 0 }, { fy: 2024, newApproved: 900, newDenied: 100, contApproved: 50, contDenied: 1 }], employers: ['GOOGLE LLC'] },
    meta: { years: [{ fy: 2023, newApproved: 0, newDenied: 0, contApproved: 0, contDenied: 0 }, { fy: 2024, newApproved: 1200, newDenied: 0, contApproved: 9, contDenied: 0 }], employers: ['META PLATFORMS INC'] },
    hidden: { years: [{ fy: 2024, newApproved: 5000, newDenied: 0, contApproved: 0, contDenied: 0 }], employers: ['X'] },
  },
};

void test('the ranking lists shown companies by the latest new-employment approvals', () => {
  const names = new Map([['google', 'Google'], ['meta', 'Meta']]);
  assert.deepEqual(h1bRanking(names, sample).map((r) => [r.slug, r.newApproved]), [['meta', 1200], ['google', 900]]);
  assert.equal(approvalRate(900, 100), 0.9);
  assert.equal(approvalRate(0, 0), null);
  assert.equal(h1bCompany('toString', sample), null);
  // The sitemap lists the (noindex while empty) ranking page only once it has data.
  assert.deepEqual(h1bPaths(sample), [{ path: '/career/h1b', updatedAt: '2026-10-15' }]);
  assert.deepEqual(h1bPaths({ ...sample, fiscalYears: [], companies: {} }), []);
});

void test('the company panel shows each year, the rate, the caveat and the source; nothing without data', () => {
  const html = renderToStaticMarkup(createElement(H1bPanel, { slug: 'google', zh: true, data: sample }));
  assert.match(html, /<h2 id="h1b">H-1B 担保记录/);
  assert.match(html, /FY2024<\/th><td>900<\/td><td>100<\/td><td>90\.0%<\/td>/);
  assert.match(html, /FY2023<\/th><td>10<\/td><td>0<\/td><td>100\.0%/);
  assert.match(html, /不是人数，也不代表某个岗位一定提供担保/);
  assert.match(html, /href="https:\/\/www\.uscis\.gov\/tools\/reports-and-studies\/h-1b-employer-data-hub" rel="noopener noreferrer"/);
  assert.match(html, /FY2023–FY2024\)，更新于 2026-10-15/);
  assert.equal(renderToStaticMarkup(createElement(H1bPanel, { slug: 'stripe', zh: false, data: sample })), '');
  // The committed file has the build's shape.
  assert.deepEqual(Object.keys(H1B).sort(), ['companies', 'fiscalYears', 'source', 'sourceUrl', 'updated']);
  for (const slug of Object.keys(H1B.companies)) assert.ok(Object.hasOwn(aliases, slug));
});
