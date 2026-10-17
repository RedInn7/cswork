// H-1B sponsor data (scripts/h1b/build.mjs → lib/content/h1b-sponsors.json → lib/server/h1b.ts):
// the hub crosstab's six petition types sum into two series (the archived Initial/Continuing
// layout counts differently and is refused), aliases pick out company page employers only, and
// the pages show counts with the source and the petitions-not-people caveat.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build, FISCAL_YEARS, matcher, normalizeName, parseCsv, readTable, records } from '../scripts/h1b/build.mjs';
import { approvalRate, H1B, h1bCompany, h1bPaths, h1bRanking, type H1bData } from '../lib/server/h1b';
import { H1bPanel } from '../app/company/h1b';

const fixture = (name: string) => readFileSync(new URL(`../fixtures/h1b/${name}`, import.meta.url));
const tables = () => [
  { file: 'fy2022-new.csv', rows: parseCsv(readTable(fixture('fy2022-new.csv'))) },
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

void test('CSV and TSV exports parse; the six categories fold into new and continuing; the old layout is refused', () => {
  const [csv, fresh] = tables();
  // New = New Employment + New Concurrent + Change of Employer; continuing = Continuation + Change with Same Employer + Amended.
  assert.deepEqual(records(csv.rows)[0], {
    fy: 2022, employer: 'GOOGLE LLC', newApproved: 1234, newDenied: 10, contApproved: 2000, contDenied: 20,
  });
  assert.deepEqual(records(fresh.rows)[0], {
    fy: 2024, employer: 'GOOGLE LLC', newApproved: 1220, newDenied: 14, contApproved: 1900, contDenied: 13,
  });
  // A UTF-16 export reads the same.
  const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(readTable(fixture('fy2024-new.tsv')), 'utf16le')]);
  assert.deepEqual(parseCsv(readTable(utf16)), fresh.rows);
  assert.throws(() => records([['Name', 'Count'], ['x', '1']], 'other.csv'), /other\.csv: not an H-1B Employer Data Hub export/);
  // The archived Data Hub Files CSVs: Initial is New Employment alone, so a year from them can't sit beside crosstab years.
  const old = [['Fiscal Year', 'Employer', 'Initial Approval', 'Initial Denial', 'Continuing Approval', 'Continuing Denial'], ['2021', 'GOOGLE LLC', '1453', '9', '4980', '50']];
  assert.throws(() => records(old, 'fy2021.csv'), /fy2021\.csv: the old Initial\/Continuing layout/);
  assert.throws(() => build([...tables(), { file: 'fy2021.csv', rows: old }], aliases), /old Initial\/Continuing layout/);
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
  // Not one of Amazon's names, though it starts with AMAZON; "AMAZON COM" and "Amazon.com" are one name, shown as the more approved spelling.
  assert.deepEqual(out.companies.amazon.employers, ['AMAZON.COM SERVICES LLC']);
  assert.equal(out.companies.amazon.employerCount, 1);
  // Neither do "&" / "AND" nor spaced initials.
  const head = ['Fiscal Year', 'Employer (Petitioner) Name', 'New Employment Approval', 'New Employment Denial', 'Continuation Approval', 'Continuation Denial'];
  const shaw = build([{ file: 'x.csv', rows: [head, ['2024', 'D E SHAW AND CO L P', '1', '0', '0', '0'], ['2024', 'D. E. Shaw & Co., L.P.', '2', '0', '0', '0']] }], aliases) as H1bData;
  assert.deepEqual(shaw.companies['the-d-e-shaw-group'].employers, ['D. E. SHAW & CO., L.P.']);
  assert.equal(shaw.companies['the-d-e-shaw-group'].employerCount, 1);
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
  // Renamed petitioners keep their earlier years: Oath Holdings became Yahoo Holdings, and the DBA is spelled both ways.
  assert.equal(match('OATH HOLDINGS INC'), 'yahoo');
  assert.equal(match('ANTHROPIC PBC DBA ANTHROPIC INC'), 'anthropic');
  assert.equal(match('ANTHROPIC PBC D/B/A ANTHROPIC INC'), 'anthropic');
  assert.equal(match('MARGARET A CARGILL PHILANTHROPIC SERVICES LLC'), null);
});

const sample: H1bData = {
  updated: '2026-10-15',
  source: 'USCIS H-1B Employer Data Hub',
  sourceUrl: 'https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub',
  fiscalYears: [2023, 2024],
  companies: {
    google: { years: [{ fy: 2023, newApproved: 10, newDenied: 0, contApproved: 5, contDenied: 0 }, { fy: 2024, newApproved: 900, newDenied: 100, contApproved: 50, contDenied: 1 }], employers: ['GOOGLE LLC'], employerCount: 1 },
    meta: { years: [{ fy: 2023, newApproved: 0, newDenied: 0, contApproved: 0, contDenied: 0 }, { fy: 2024, newApproved: 1200, newDenied: 0, contApproved: 9, contDenied: 0 }], employers: ['META PLATFORMS INC'], employerCount: 3 },
    hidden: { years: [{ fy: 2024, newApproved: 5000, newDenied: 0, contApproved: 0, contDenied: 0 }], employers: ['X'], employerCount: 1 },
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
  assert.match(html, /<summary>计入的雇主名称（1）<\/summary>/);
  // Only the most approved names are listed, and the summary says how many were counted.
  const meta = renderToStaticMarkup(createElement(H1bPanel, { slug: 'meta', zh: false, data: sample }));
  assert.match(meta, /<summary>Employer names counted \(top 1 of 3\)<\/summary>/);
  assert.equal(renderToStaticMarkup(createElement(H1bPanel, { slug: 'stripe', zh: false, data: sample })), '');
  // The committed file has the build's shape.
  assert.deepEqual(Object.keys(H1B).sort(), ['companies', 'fiscalYears', 'source', 'sourceUrl', 'updated']);
  for (const slug of Object.keys(H1B.companies)) assert.ok(Object.hasOwn(aliases, slug));
});

void test('the committed data is sane: consecutive years, whole counts, the big sponsors present', { skip: !H1B.fiscalYears.length }, () => {
  assert.match(H1B.updated ?? '', /^\d{4}-\d{2}-\d{2}$/);
  const fys = H1B.fiscalYears;
  assert.ok(fys.length <= FISCAL_YEARS);
  fys.forEach((fy, i) => i && assert.equal(fy, fys[i - 1] + 1, 'consecutive fiscal years'));
  for (const [slug, c] of Object.entries(H1B.companies)) {
    assert.deepEqual(c.years.map((y) => y.fy), fys, `${slug}: one row per fiscal year`);
    for (const y of c.years)
      for (const n of [y.newApproved, y.newDenied, y.contApproved, y.contDenied]) assert.ok(Number.isInteger(n) && n >= 0, `${slug} FY${y.fy}`);
    assert.ok(c.employers.length <= 10 && c.employerCount >= c.employers.length, slug);
    // Continuations are only filed for the petitioner's own H-1B workers, so many of them after a
    // near-empty year mean the earlier years are under a name the aliases miss (Oath → Yahoo:
    // FY2023 2 petitions, FY2024 143 continuations).
    c.years.forEach((y, i) => {
      const prev = c.years[i - 1];
      if (prev && y.contApproved > 50)
        assert.ok((prev.newApproved + prev.newDenied + prev.contApproved + prev.contDenied) * 10 >= y.contApproved, `${slug} FY${y.fy}: a renamed petitioner missing from the aliases?`);
    });
  }
  // A broken alias or name normalization shows up here first.
  for (const slug of ['amazon', 'google', 'microsoft', 'meta']) assert.ok(h1bCompany(slug)!.years.at(-1)!.newApproved > 100, slug);
});
