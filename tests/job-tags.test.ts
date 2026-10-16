// Read-time tags on openings (lib/job-tags.ts): role category, term, hiring cycle, link matching
// and the /career/jobs filter.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hiringCycle,
  jobLinkKey,
  matchesSearch,
  roleCategory,
  searchFromQuery,
  searchQuery,
  sortTerms,
  termKey,
  termLabel,
  termOf,
  DEFAULT_SEARCH,
} from '../lib/job-tags';

void test('role categories, checked in order', () => {
  for (const [title, category] of [
    ['Software Engineer, New Grad', 'swe'],
    ['Forward Deployed Engineer, Internship', 'swe'],
    ['iOS Developer Intern', 'swe'],
    ['Full Stack Engineer - Early Career', 'swe'],
    ['2027 校招 后端开发', 'swe'],
    ['Machine Learning Engineer Intern', 'ml'],
    ['AI Research Scientist, New Grad', 'ml'],
    ['Software Engineer Intern, ML Platform', 'ml'],
    ['Research Scientist Intern', 'ml'],
    ['Data Science Intern', 'data'],
    ['Data Engineer, University Graduate', 'data'],
    ['Product Analytics Intern', 'data'],
    ['Site Reliability Engineer, New Grad', 'infra'],
    ['Software Engineer Intern, Cloud Infrastructure', 'infra'],
    ['Security Engineer Intern', 'security'],
    ['Cybersecurity Analyst, Entry Level', 'security'],
    ['Firmware Engineer Intern', 'hardware'],
    ['ASIC Design Engineer, New College Grad', 'hardware'],
    ['Electrical Engineering Intern', 'hardware'],
    ['Quantitative Researcher Intern', 'quant'],
    ['Summer Internship 2027, Trading', 'quant'],
    ['Entry-Level Quant Developer', 'quant'],
    ['Associate Product Manager, New Grad', 'pm'],
    ['Technical Program Management Intern', 'pm'],
    ['Marketing Intern', 'other'],
    ['Finance Intern, Summer 2027', 'other'],
    ['Sales Engineer, Early Career', 'other'],
    ['Mechanical Engineering Intern', 'other'],
    ['Product Design Intern', 'other'],
    ['University Graduate', 'other'],
    // "aid" and "html" are no AI or ML; a software role at a sales team is still software.
    ['Financial Aid Software Engineer Intern', 'swe'],
    ['Software Engineer, Sales Tools', 'swe'],
    // A business role on a technical team is still 'other'; a technical role on a business team is not.
    ['Finance Intern, Trading', 'other'],
    ['Cloud Sales Intern', 'other'],
    ['Product Marketing Intern, AI Platform', 'other'],
    ['Legal Intern, Platform', 'other'],
    ['Account Executive, Platform - New Grad', 'other'],
    ['Sales Development Representative (AI), Early Career', 'other'],
    ['Machine Learning Engineer, Finance', 'ml'],
    ['Data Analyst, Marketing', 'data'],
    ['Product Manager, Sales Tools', 'pm'],
    ['Quantitative Finance Intern', 'quant'],
  ] as const)
    assert.equal(roleCategory(title), category, title);
});

void test('terms in titles', () => {
  assert.deepEqual(termOf('Software Engineer Intern (Summer 2027)'), { season: 'summer', year: 2027, coop: false });
  assert.deepEqual(termOf('Fall 2026 Co-op, Firmware'), { season: 'fall', year: 2026, coop: true });
  assert.deepEqual(termOf('New Grad Software Engineer - 2027 Start'), { season: null, year: 2027, coop: false });
  assert.deepEqual(termOf('Software Engineer, University Graduate (2026–2027)'), { season: null, year: 2026, coop: false });
  assert.deepEqual(termOf("Autumn '26 Coop"), { season: 'fall', year: 2026, coop: true });
  assert.deepEqual(termOf('Winter Intern'), { season: 'winter', year: null, coop: false });
  assert.deepEqual(termOf('Software Engineer, New Grad'), { season: null, year: null, coop: false });
  // A requisition number is no year.
  assert.equal(termOf('Intern R12027').year, null);
  assert.equal(termKey(termOf('Summer 2027 Intern')), 'summer-2027');
  assert.equal(termKey(termOf('2027 Start')), '2027');
  assert.equal(termKey(termOf('Summer Intern')), 'summer');
  assert.equal(termKey(termOf('Intern')), '');
  assert.equal(termLabel('summer-2027', true), '2027 夏季');
  assert.equal(termLabel('summer-2027', false), 'Summer 2027');
  assert.equal(termLabel('2027', false), '2027');
  assert.equal(termLabel('winter', true), '冬季');
  assert.deepEqual(sortTerms(['summer', 'fall-2026', '2027', 'summer-2027', 'spring-2027', '', '2027']), ['fall-2026', '2027', 'spring-2027', 'summer-2027', 'summer']);
  // Calendar order: a Winter 2027 term (January to April) comes before Spring 2027.
  assert.deepEqual(sortTerms(['fall-2027', 'winter-2027', 'summer-2027', 'spring-2027', 'winter-2028']), ['winter-2027', 'spring-2027', 'summer-2027', 'fall-2027', 'winter-2028']);
});

void test('the hiring cycle: a plausible title year, else July on hires for next year', () => {
  assert.equal(hiringCycle(Date.UTC(2026, 5, 30)), 2026);
  assert.equal(hiringCycle(Date.UTC(2026, 6, 1)), 2027);
  assert.equal(hiringCycle(Date.UTC(2026, 11, 31, 23)), 2027);
  assert.equal(hiringCycle(Date.UTC(2026, 8, 1), 'Fall 2026 Co-op'), 2026);
  assert.equal(hiringCycle(Date.UTC(2026, 2, 1), 'Summer 2028 Intern'), 2028);
  // A year far off is a typo or a number, not a term.
  assert.equal(hiringCycle(Date.UTC(2026, 8, 1), 'Intern 2031'), 2027);
});

void test('posting links compare without hash, tracking parameters or a trailing slash', () => {
  assert.equal(jobLinkKey('https://jobs.lever.co/acme/a1/?utm_source=x&utm_medium=y#apply'), 'https://jobs.lever.co/acme/a1');
  assert.equal(jobLinkKey('https://stripe.com/jobs/search?gh_jid=1&gh_src=abc'), 'https://stripe.com/jobs/search?gh_jid=1');
  assert.notEqual(jobLinkKey('https://stripe.com/jobs/search?gh_jid=1'), jobLinkKey('https://stripe.com/jobs/search?gh_jid=2'));
  assert.equal(jobLinkKey('not a link'), '');
});

void test('the filter: from the query, back to the query, and matching', () => {
  const get = (q: string) => (name: string) => new URLSearchParams(q).get(name)?.trim() ?? '';
  assert.deepEqual(searchFromQuery(get('')), DEFAULT_SEARCH);
  assert.deepEqual(searchFromQuery(get('kind=intern&role=ml&term=summer-2027&q=New%20York&company=stripe&paid=1')), {
    kind: 'intern',
    role: 'ml',
    term: 'summer-2027',
    q: 'New York',
    company: 'stripe',
    paid: true,
  });
  assert.deepEqual(searchFromQuery(get('kind=boss&role=x&term=<b>&company=A%20B&paid=yes')), DEFAULT_SEARCH);
  assert.equal(String(searchQuery(DEFAULT_SEARCH)), 'role=tech');
  assert.equal(String(searchQuery({ ...DEFAULT_SEARCH, kind: 'intern', paid: true })), 'role=tech&kind=intern&paid=1');
  const o = { title: 'Software Engineer Intern, Summer 2027', location: 'New York, NY', kind: 'intern', companySlug: 'stripe', pay: null };
  assert.ok(matchesSearch(o, DEFAULT_SEARCH));
  assert.ok(matchesSearch(o, { ...DEFAULT_SEARCH, kind: 'intern', role: 'swe', term: 'summer-2027', q: 'new york', company: 'stripe' }));
  assert.ok(!matchesSearch(o, { ...DEFAULT_SEARCH, paid: true }));
  assert.ok(matchesSearch({ ...o, pay: { min: 40, max: 50 } }, { ...DEFAULT_SEARCH, paid: true }));
  assert.ok(!matchesSearch(o, { ...DEFAULT_SEARCH, term: '2027' }));
  assert.ok(!matchesSearch({ ...o, title: 'Marketing Intern' }, DEFAULT_SEARCH));
  assert.ok(matchesSearch({ ...o, title: 'Marketing Intern' }, { ...DEFAULT_SEARCH, role: 'all' }));
  assert.ok(!matchesSearch({ ...o, title: 'Associate Product Manager' }, DEFAULT_SEARCH));
});
