// Read-time tags on openings (lib/job-tags.ts): role category, term, hiring cycle, link matching
// and the /career/jobs filter.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTH_FLAGS,
  authFlags,
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
    sponsorOk: false,
  });
  assert.equal(searchFromQuery(get('sponsor=1')).sponsorOk, true);
  assert.equal(String(searchQuery({ ...DEFAULT_SEARCH, sponsorOk: true })), 'role=tech&sponsor=1');
  assert.deepEqual(searchFromQuery(get('kind=boss&role=x&term=<b>&company=A%20B&paid=yes')), DEFAULT_SEARCH);
  assert.equal(String(searchQuery(DEFAULT_SEARCH)), 'role=tech');
  assert.equal(String(searchQuery({ ...DEFAULT_SEARCH, kind: 'intern', paid: true })), 'role=tech&kind=intern&paid=1');
  const o = { title: 'Software Engineer Intern, Summer 2027', location: 'New York, NY', kind: 'intern', companySlug: 'stripe', pay: null, authFlags: -1 };
  assert.ok(matchesSearch(o, DEFAULT_SEARCH));
  assert.ok(matchesSearch(o, { ...DEFAULT_SEARCH, kind: 'intern', role: 'swe', term: 'summer-2027', q: 'new york', company: 'stripe' }));
  assert.ok(!matchesSearch(o, { ...DEFAULT_SEARCH, paid: true }));
  assert.ok(matchesSearch({ ...o, pay: { min: 40, max: 50 } }, { ...DEFAULT_SEARCH, paid: true }));
  assert.ok(!matchesSearch(o, { ...DEFAULT_SEARCH, term: '2027' }));
  assert.ok(!matchesSearch({ ...o, title: 'Marketing Intern' }, DEFAULT_SEARCH));
  assert.ok(matchesSearch({ ...o, title: 'Marketing Intern' }, { ...DEFAULT_SEARCH, role: 'all' }));
  assert.ok(!matchesSearch({ ...o, title: 'Associate Product Manager' }, DEFAULT_SEARCH));
  // "Hide no-sponsorship roles" hides judged openings with a flag; not yet judged (-1) and clear (0) ones stay.
  const sponsorOk = { ...DEFAULT_SEARCH, sponsorOk: true };
  assert.ok(matchesSearch(o, sponsorOk));
  assert.ok(matchesSearch({ ...o, authFlags: 0 }, sponsorOk));
  for (const flags of [1, 2, 4, 7]) {
    assert.ok(!matchesSearch({ ...o, authFlags: flags }, sponsorOk), String(flags));
    assert.ok(matchesSearch({ ...o, authFlags: flags }, DEFAULT_SEARCH), String(flags));
  }
});

const { noSponsor, citizenOrGc, clearance } = AUTH_FLAGS;
void test('auth flags: what a description says about sponsorship, citizenship and clearance', () => {
  for (const [text, flags] of [
    ['Unfortunately, we are unable to sponsor visas for this position.', noSponsor],
    ['This position is not eligible for visa sponsorship.', noSponsor],
    ['This role is not eligible for immigration sponsorship', noSponsor],
    ['We will not sponsor an employment visa for this role.', noSponsor],
    ['The company does not offer immigration sponsorship.', noSponsor],
    ['We are not able to provide sponsorship at this time.', noSponsor],
    ['We are not currently able to sponsor work visas.', noSponsor],
    ['Candidates must be authorized to work in the U.S. without the need for visa sponsorship now or in the future.', noSponsor],
    ['Applicants must not now or in the future require sponsorship for employment visa status.', noSponsor],
    ['Please do not apply if you will need visa sponsorship.', noSponsor],
    ['Visa sponsorship is not available.', noSponsor],
    ['Visa sponsorship: not available', noSponsor],
    ['No visa sponsorship.', noSponsor],
    ['We can’t sponsor H-1B visas.', noSponsor],
    ['No visa sponsorship is available for this position.', noSponsor],
    ['No sponsorship available.', noSponsor],
    ['No sponsorship will be provided for this role.', noSponsor],
    ['No immigration sponsorship is offered.', noSponsor],
    ['We won’t be able to sponsor visas.', noSponsor],
    ["We aren't able to provide sponsorship.", noSponsor],
    ["This role isn't eligible for sponsorship.", noSponsor],
    ['Applicants must be authorized to work in the U.S. without employer sponsorship.', noSponsor],
    ['You must be able to work without the need for employer sponsorship now or in the future.', noSponsor],
    ['Must be authorized to work without company sponsorship.', noSponsor],
    ['Candidates requiring sponsorship will not be considered.', noSponsor],
    ['We are unable to offer relocation or visa sponsorship.', noSponsor],
    ['Must be a U.S. citizen or green card holder.', citizenOrGc],
    ['U.S. citizenship is required due to government contract requirements.', citizenOrGc],
    ['This program is only open to U.S. citizens.', citizenOrGc],
    ['Open only to United States citizens and permanent residents', citizenOrGc],
    ['This role requires US citizenship.', citizenOrGc],
    ['Must be able to obtain and maintain a security clearance.', clearance],
    ['Active TS/SCI clearance is required.', clearance],
    ['This position requires an active Secret clearance', clearance],
    ['TS/SCI with polygraph required', clearance],
    ['Applicants must be U.S. citizens and able to obtain a security clearance.', citizenOrGc | clearance],
    ['Due to ITAR, you must be a U.S. citizen and must hold an active Secret clearance. We cannot sponsor visas.', noSponsor | citizenOrGc | clearance],
    ['Requirements\nMust be a US citizen\nSponsorship: not available', noSponsor | citizenOrGc],
    ['You must be a U.S. citizen and will not require sponsorship.', noSponsor | citizenOrGc],
    ['Must be a U.S. citizen or permanent resident of the U.S.', citizenOrGc],
    ['We do not sponsor visas.', noSponsor],
  ] as const)
    assert.equal(authFlags(text), flags, text);
});

void test('auth flags: notices, offers to sponsor and lines without must, required or only are none', () => {
  for (const text of [
    // An EEO statement and the E-Verify / right-to-work notices.
    'We are an equal opportunity employer and consider qualified applicants without regard to race, religion, sex, national origin, citizenship status, disability or veteran status.',
    'Employers may not discriminate against U.S. citizens, permanent residents, refugees, asylees or other work-authorized individuals.',
    'To meet export control rules, applicants must be U.S. persons: U.S. citizens, permanent residents, refugees or asylees.',
    'Applicants must be U.S. citizens, permanent residents, refugees, asylees, or otherwise authorized to work.',
    'To conform to U.S. Government export regulations, applicant must be a U.S. citizen, lawful permanent resident, protected individual as defined by 8 U.S.C. 1324b(a)(3), or eligible to obtain the required authorizations from the U.S. Department of State.',
    'Applicants must be a U.S. citizen or national, lawful permanent resident, or be eligible to obtain the required authorizations from the U.S. Department of State.',
    'Candidates must be U.S. citizens or eligible to work in the U.S.',
    'This company participates in E-Verify and will confirm the employment eligibility of each new hire.',
    'We will sponsor H-1B visas for qualified candidates.',
    'Visa sponsorship available.',
    'Sponsorship is available for this role.',
    'We are happy to provide visa sponsorship.',
    'We sponsor employment visas, including H-1B and STEM OPT extensions.',
    // A hedge and an affirmation in one sentence; any work authorization accepted; another country's residency.
    "While we can't sponsor for every role, we do sponsor H-1B visas for this position.",
    'We are not able to sponsor for all teams, but this role does offer visa sponsorship.',
    'Must be a U.S. citizen, green card holder, or hold a valid work visa (H-1B, OPT, etc.).',
    'Candidates must be US citizens or green card holders, or have a valid EAD.',
    'Must be a permanent resident of Canada or a Canadian citizen.',
    'Canadian citizenship or permanent residency required.',
    'No security clearance required.',
    'This role does not require a security clearance.',
    'Security clearance is not required for this internship.',
    'U.S. citizenship is not required.',
    'You do not need to be a U.S. citizen to apply.',
    'Green card holders and permanent residents are welcome to apply.',
    'Candidates who need sponsorship are encouraged to apply.',
    'Export control: this role may involve technology covered by export regulations.',
    'Our work involves government clients; a clearance is a plus.',
    'Some roles may require a security clearance or U.S. citizenship.',
    'Active security clearance preferred.',
    'Must obtain medical clearance before start date.',
    'This role requires current medical clearance.',
    'Must be authorized to work in the United States.',
    '',
  ])
    assert.equal(authFlags(text), 0, text);
});
