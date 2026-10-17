// New-grad and intern openings (lib/server/job-openings.ts): parsing the three ATS boards' JSON and
// posted pay, the title filter, the 20-hour sync throttle, hiding stale openings and hidden
// companies, hiring seasons and pay samples (lib/server/job-seasons.ts), auth flags read from the
// descriptions, and the openings in the followed-company and saved-search digest
// (lib/server/company-follows.ts).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const dir = mkdtempSync(join(tmpdir(), 'cswork-job-openings-'));
process.env.DATABASE_PATH = join(dir, 'app.sqlite');
const { sqlite } = await import('../db/sqlite');
const { BOARDS, boardOpenings, freshOpenings, openingKind, parseJobSearch, syncJobOpenings, viewerJobSearch } = await import('../lib/server/job-openings');
const { jobSeasons, seasonsSince } = await import('../lib/server/job-seasons');
const { sendCompanyDigest } = await import('../lib/server/company-follows');
const { DEFAULT_SEARCH } = await import('../lib/job-tags');
const { englishMessage } = await import('../lib/messages-en');

before(() => migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') }));
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

const HOUR = 3600000;
// Made-up postings in each board API's shape (descriptions and the other fields left out).
const greenhouse = {
  jobs: [
    { id: 101, title: 'Software Engineer, New Grad', location: { name: 'Seattle, WA' }, absolute_url: 'https://example.com/jobs?gh_jid=101', first_published: '2026-10-01T09:00:00-04:00', updated_at: '2026-10-05T09:00:00-04:00' },
    { id: 102, title: 'Senior Software Engineer', location: { name: 'Remote' }, absolute_url: 'https://example.com/jobs?gh_jid=102' },
    { id: 103, title: 'Software Engineering Intern (Summer 2027)', location: { name: 'New York, NY' }, absolute_url: 'http://example.com/jobs?gh_jid=103' },
    { id: 104, title: 'Data Science Intern', location: { name: 'Austin, TX' }, absolute_url: 'https://example.com/jobs?gh_jid=104', updated_at: 'not a date' },
  ],
  meta: { total: 4 },
};
const lever = [
  { id: 'a1', text: 'Forward Deployed Engineer, Internship', categories: { location: 'London', team: 'Eng' }, hostedUrl: 'https://jobs.lever.co/acme/a1', createdAt: 1790000000000 },
  { id: 'a2', text: 'Engineering Manager, University Programs', categories: { location: 'London' }, hostedUrl: 'https://jobs.lever.co/acme/a2' },
  { id: 'a3', text: 'Software Engineer - Early Career', categories: {}, hostedUrl: 'https://user:pw@jobs.lever.co/acme/a3' },
];
const ashby = {
  jobs: [
    { id: 'u1', title: '  Software   Engineer, University Graduate ', location: 'San Francisco', jobUrl: 'https://jobs.ashbyhq.com/acme/u1', publishedAt: '2026-10-10T00:00:00.000+00:00', isListed: true },
    { id: 'u2', title: 'Research Intern', location: 'Remote', jobUrl: 'https://jobs.ashbyhq.com/acme/u2', isListed: false },
    { id: 'u3', title: 'Lead Product Designer', location: 'Remote', jobUrl: 'https://jobs.ashbyhq.com/acme/u3' },
  ],
  apiVersion: '1',
};

void test('the title filter keeps early-career roles and drops senior ones', () => {
  for (const [title, kind] of [
    ['Software Engineer, New Grad', 'new-grad'],
    ['New Graduate Software Engineer', 'new-grad'],
    ['Entry-Level Quant Developer', 'new-grad'],
    ['Early Career Software Engineer', 'new-grad'],
    ['2027 校招 后端开发', 'new-grad'],
    ['Summer Internship 2027, Trading', 'intern'],
    ['Graduate Software Engineer Intern', 'intern'],
    ['Senior Software Engineer, New Grad Programs', null],
    ['Staff Engineer', null],
    ['Principal Graduate Recruiter', null],
    ['University Recruiting Coordinator', null],
    ['Tech Lead, Early Career', null],
    ['Director, Internal Tools', null],
    ['Software Engineer, Internal Platforms', null], // "internal" is no internship
    ['International Payments Engineer', null],
    ['Undergraduate Ambassador', null],
  ] as const)
    assert.equal(openingKind(title), kind, title);
});

void test('each board’s JSON parses to openings with https links and dates', () => {
  assert.deepEqual(boardOpenings('acme', { ats: 'greenhouse', board: 'acme' }, greenhouse), [
    { id: 'greenhouse:acme:101', companySlug: 'acme', title: 'Software Engineer, New Grad', location: 'Seattle, WA', url: 'https://example.com/jobs?gh_jid=101', kind: 'new-grad', postedAt: Date.parse('2026-10-01T13:00:00Z'), pay: null, authFlags: -1 },
    // 103 is http: left out. A date that does not parse is no date.
    { id: 'greenhouse:acme:104', companySlug: 'acme', title: 'Data Science Intern', location: 'Austin, TX', url: 'https://example.com/jobs?gh_jid=104', kind: 'intern', postedAt: null, pay: null, authFlags: -1 },
  ]);
  // Credentials in the link: left out.
  assert.deepEqual(boardOpenings('acme', { ats: 'lever', board: 'acme' }, lever), [
    { id: 'lever:acme:a1', companySlug: 'acme', title: 'Forward Deployed Engineer, Internship', location: 'London', url: 'https://jobs.lever.co/acme/a1', kind: 'intern', postedAt: 1790000000000, pay: null, authFlags: -1 },
  ]);
  // Unlisted Ashby postings are left out; whitespace in titles is tidied.
  assert.deepEqual(boardOpenings('acme', { ats: 'ashby', board: 'acme' }, ashby), [
    { id: 'ashby:acme:u1', companySlug: 'acme', title: 'Software Engineer, University Graduate', location: 'San Francisco', url: 'https://jobs.ashbyhq.com/acme/u1', kind: 'new-grad', postedAt: Date.parse('2026-10-10T00:00:00Z'), pay: null, authFlags: -1 },
  ]);
  // Junk is no opening, never an exception.
  for (const body of [null, 'oops', { jobs: 'x' }, [{ id: 1 }], { ok: false, error: 'Document not found' }])
    for (const ats of ['greenhouse', 'lever', 'ashby'] as const) assert.deepEqual(boardOpenings('acme', { ats, board: 'acme' }, body), []);
  // A link too long for the tracker's link field is left out.
  const long = { jobs: [{ ...greenhouse.jobs[0], absolute_url: `https://example.com/${'x'.repeat(500)}` }] };
  assert.deepEqual(boardOpenings('acme', { ats: 'greenhouse', board: 'acme' }, long), []);
});

void test('posted pay: Lever’s salary range and Ashby’s Salary component, plausible USD or CAD only', () => {
  const lever = (salaryRange: unknown) =>
    boardOpenings('acme', { ats: 'lever', board: 'acme' }, [{ id: 'p', text: 'Software Engineer Intern', categories: {}, hostedUrl: 'https://jobs.lever.co/acme/p', salaryRange }])[0].pay;
  assert.deepEqual(lever({ min: 40, max: 55.5, currency: 'USD', interval: 'per-hour-wage' }), { min: 40, max: 56, currency: 'USD', unit: 'hour' });
  assert.deepEqual(lever({ min: 120000, max: 150000, currency: 'CAD', interval: 'per-year-salary' }), { min: 120000, max: 150000, currency: 'CAD', unit: 'year' });
  assert.deepEqual(lever({ min: 8000, max: 9500, currency: 'USD', interval: 'per-month-salary' }), { min: 8000, max: 9500, currency: 'USD', unit: 'month' });
  for (const bad of [
    undefined,
    { min: 5000, max: 5000, currency: 'USD', interval: 'one-time' }, // a bonus, not a rate
    { min: 50000, max: 60000, currency: 'EUR', interval: 'per-year-salary' }, // bounds are in dollars
    { min: 60, max: 40, currency: 'USD', interval: 'per-hour-wage' }, // min above max
    { min: 5, max: 9, currency: 'USD', interval: 'per-hour-wage' },
    { min: 40, max: 400, currency: 'USD', interval: 'per-hour-wage' },
    { min: 45, max: 55, currency: 'USD', interval: 'per-year-salary' }, // an hourly rate as a salary
    { min: 900000, max: 2000000, currency: 'USD', interval: 'per-year-salary' },
    { min: 500, max: 900, currency: 'USD', interval: 'per-month-salary' },
    { min: '40', max: '50', currency: 'USD', interval: 'per-hour-wage' },
    { max: 50, currency: 'USD', interval: 'per-hour-wage' },
  ])
    assert.equal(lever(bad), null, JSON.stringify(bad));
  const ashby = (summaryComponents: unknown) =>
    boardOpenings('acme', { ats: 'ashby', board: 'acme' }, { jobs: [{ id: 'q', title: 'Software Engineer, New Grad', location: 'NYC', jobUrl: 'https://jobs.ashbyhq.com/acme/q', compensation: { summaryComponents } }] })[0].pay;
  const equity = { compensationType: 'EquityCashValue', interval: '1 YEAR', currencyCode: 'USD', minValue: null, maxValue: null };
  assert.deepEqual(ashby([equity, { compensationType: 'Salary', interval: '1 YEAR', currencyCode: 'USD', minValue: 140000, maxValue: 180000 }]), {
    min: 140000,
    max: 180000,
    currency: 'USD',
    unit: 'year',
  });
  assert.deepEqual(ashby([{ compensationType: 'Salary', interval: '1 HOUR', currencyCode: 'USD', minValue: 40, maxValue: 40 }]), { min: 40, max: 40, currency: 'USD', unit: 'hour' });
  assert.deepEqual(ashby([{ compensationType: 'Salary', interval: '1 MONTH', currencyCode: 'USD', minValue: 7000, maxValue: 9000 }])?.unit, 'month');
  for (const bad of [
    undefined,
    [equity],
    [{ compensationType: 'Salary', interval: '1 MONTH', currencyCode: 'SEK', minValue: 40000, maxValue: 50000 }],
    [{ compensationType: 'Salary', interval: '1 WEEK', currencyCode: 'USD', minValue: 2000, maxValue: 2500 }],
    [{ compensationType: 'Bonus', interval: '1 YEAR', currencyCode: 'USD', minValue: 20000, maxValue: 30000 }],
  ])
    assert.equal(ashby(bad), null, JSON.stringify(bad));
  // Greenhouse's list has no pay.
  assert.equal(boardOpenings('acme', { ats: 'greenhouse', board: 'acme' }, greenhouse)[0].pay, null);
});

void test('auth flags from the description: Lever’s text and lists, Ashby’s text; Greenhouse’s list has none', () => {
  const posting = (id: string, extra: object) => ({ id, text: 'Software Engineer Intern', categories: {}, hostedUrl: `https://jobs.lever.co/acme/${id}`, ...extra });
  const lever = boardOpenings('acme', { ats: 'lever', board: 'acme' }, [
    posting('f1', {
      descriptionPlain: 'Build things.\nWe sponsor visas.',
      lists: [{ text: 'Requirements', content: '<li>Python &amp; SQL</li><li>Must be a <b>U.S. citizen</b></li>' }],
      additionalPlain: 'This role does not require a security clearance.',
    }),
    posting('f2', { additionalPlain: 'We are unable to sponsor work visas.' }),
    posting('f3', { descriptionPlain: 'Build things with us.' }),
    posting('f4', { lists: [] }),
  ]);
  // No description at all is not yet judged.
  assert.deepEqual(lever.map((o) => o.authFlags), [2, 1, 0, -1]);
  const ashby = boardOpenings('acme', { ats: 'ashby', board: 'acme' }, {
    jobs: [{ id: 'f5', title: 'Software Engineer, New Grad', jobUrl: 'https://jobs.ashbyhq.com/acme/f5', descriptionPlain: 'Must be able to obtain a security clearance.' }],
  });
  assert.equal(ashby[0].authFlags, 4);
  assert.equal(boardOpenings('acme', { ats: 'greenhouse', board: 'acme' }, greenhouse)[0].authFlags, -1);
});

void test('every mapped board is a known ATS with a plain board name', () => {
  assert.ok(Object.keys(BOARDS).length >= 50);
  for (const [slug, { ats, board }] of Object.entries(BOARDS)) {
    assert.match(slug, /^[a-z0-9-]+$/);
    assert.ok(['greenhouse', 'lever', 'ashby'].includes(ats), slug);
    assert.match(board, /^[a-z0-9-]+$/, slug);
  }
});

const boards = {
  acme: { ats: 'greenhouse', board: 'acme' },
  leverco: { ats: 'lever', board: 'leverco' },
  ashco: { ats: 'ashby', board: 'ashco' },
  downco: { ats: 'greenhouse', board: 'downco' },
} as const;
let replies: Record<string, unknown> = {};
// URL endings that time out.
let timeouts: string[] = [];
const asked: string[] = [];
globalThis.fetch = async (input: string | URL | Request) => {
  const url = String(input);
  asked.push(url);
  if (url.includes('/downco/')) throw new Error('network down');
  if (timeouts.some((end) => url.endsWith(end))) throw new DOMException('The operation timed out.', 'TimeoutError');
  // A board list's key never answers its Greenhouse detail URLs (…/jobs/<id>).
  const reply = Object.entries(replies).find(([part]) => url.endsWith(part) || url.includes(`${part}?`));
  return reply ? Response.json(reply[1]) : Response.json({ ok: false }, { status: 404 });
};

void test('sync: at most every 20 hours, a failed board skipped, stale openings hidden', async () => {
  const t0 = Date.UTC(2026, 9, 12, 1);
  const paid = [{ ...lever[0], salaryRange: { min: 45, max: 55, currency: 'USD', interval: 'per-hour-wage' } }, ...lever.slice(1)];
  replies = {
    'greenhouse.io/v1/boards/acme/jobs': greenhouse,
    // Greenhouse's detail: HTML escaped as entities.
    'greenhouse.io/v1/boards/acme/jobs/101': { id: 101, content: '&lt;p&gt;We are &lt;strong&gt;unable to sponsor&lt;/strong&gt; visas for this role.&lt;/p&gt;' },
    'lever.co/v0/postings/leverco?mode=json': paid,
    'ashbyhq.com/posting-api/job-board/ashco': ashby,
  };
  timeouts = ['/acme/jobs/104'];
  assert.equal(await syncJobOpenings(t0, boards), 4);
  // Four boards and Acme's two openings' details.
  assert.equal(asked.length, 6);
  assert.ok(asked.includes('https://api.ashbyhq.com/posting-api/job-board/ashco?includeCompensation=true'));
  assert.ok(asked.includes('https://boards-api.greenhouse.io/v1/boards/acme/jobs/101'));
  // Read from the detail; a detail that timed out stays unknown.
  const t1 = t0 + 21 * HOUR;
  const flags = () => Object.fromEntries(freshOpenings(t1).map((o) => [o.id, o.authFlags]));
  assert.deepEqual(flags(), { 'greenhouse:acme:101': 1, 'greenhouse:acme:104': -1, 'lever:leverco:a1': -1, 'ashby:ashco:u1': -1 });
  // Pay is stored and read back.
  assert.deepEqual(freshOpenings(t0, 'leverco')[0].pay, { min: 45, max: 55, currency: 'USD', unit: 'hour' });
  // Each board that answered gets its own row, listed nowhere.
  assert.deepEqual(sqlite().prepare("SELECT id FROM job_openings WHERE kind='board' ORDER BY id").pluck().all(), ['ashby:ashco:', 'greenhouse:acme:', 'lever:leverco:']);
  assert.deepEqual(
    freshOpenings(t0).map((o) => o.id),
    // Newest first; one with no posting date by when it was first seen.
    ['greenhouse:acme:104', 'ashby:ashco:u1', 'greenhouse:acme:101', 'lever:leverco:a1'],
  );
  assert.deepEqual(freshOpenings(t0, 'leverco').map((o) => o.id), ['lever:leverco:a1']);
  // Within 20 hours nothing is asked again, even after a failure.
  assert.equal(await syncJobOpenings(t0 + 19 * HOUR, boards), null);
  assert.equal(asked.length, 6);
  // Next day: Acme's new-grad posting is gone, the Lever board fails; both keep their old rows.
  // Ashby now publishes a salary for u1: an update writes it.
  const ashbyPaid = { jobs: [{ ...ashby.jobs[0], compensation: { summaryComponents: [{ compensationType: 'Salary', interval: '1 YEAR', currencyCode: 'USD', minValue: 130000, maxValue: 160000 }] } }, ...ashby.jobs.slice(1)] };
  // 104's detail answers this time.
  replies = {
    'greenhouse.io/v1/boards/acme/jobs': { jobs: greenhouse.jobs.slice(1) },
    'greenhouse.io/v1/boards/acme/jobs/104': { id: 104, content: '&lt;p&gt;We sponsor visas.&lt;/p&gt;' },
    'ashbyhq.com/posting-api/job-board/ashco': ashbyPaid,
  };
  timeouts = [];
  assert.equal(await syncJobOpenings(t1, boards), 2);
  // Four boards and 104's detail again.
  assert.equal(asked.length, 11);
  assert.equal(asked.filter((url) => url.endsWith('/acme/jobs/101')).length, 1);
  assert.deepEqual(flags(), { 'greenhouse:acme:101': 1, 'greenhouse:acme:104': 0, 'lever:leverco:a1': -1, 'ashby:ashco:u1': -1 });
  const first = sqlite().prepare('SELECT first_seen_at AS f,last_seen_at AS l FROM job_openings WHERE id=?');
  assert.deepEqual(first.get('ashby:ashco:u1'), { f: t0, l: t1 });
  assert.deepEqual(first.get('greenhouse:acme:101'), { f: t0, l: t0 });
  assert.deepEqual(freshOpenings(t1, 'ashco')[0].pay, { min: 130000, max: 160000, currency: 'USD', unit: 'year' });
  // Three days after it was last seen, an opening is no longer shown.
  assert.equal(freshOpenings(t0 + 72 * HOUR).length, 4);
  assert.deepEqual(
    freshOpenings(t0 + 73 * HOUR).map((o) => o.id),
    ['greenhouse:acme:104', 'ashby:ashco:u1'],
  );
  // Hidden companies are hidden here too.
  process.env.HIDDEN_COMPANIES = 'ashco';
  try {
    assert.deepEqual(freshOpenings(t1).map((o) => o.companySlug).sort(), ['acme', 'acme', 'leverco']);
  } finally {
    delete process.env.HIDDEN_COMPANIES;
  }
});

void test('the digest: new openings at followed companies, not a board’s first sync', async () => {
  // Beijing 2026-10-15 09:00 is 01:00 UTC.
  const nine = Date.UTC(2026, 9, 15, 1);
  const db = sqlite();
  db.prepare('DELETE FROM job_openings').run();
  const row = (id: string, company: string, firstSeen: number, kind = 'intern') =>
    db
      .prepare("INSERT INTO job_openings(id,company_slug,title,location,url,kind,first_seen_at,last_seen_at) VALUES(?,?,'SWE Intern','','https://example.com/j',?,?,?)")
      .run(id, company, kind, firstSeen, nine - HOUR);
  // Stripe's board was first synced long ago; two openings since. Airbnb's board was first synced yesterday.
  row('greenhouse:stripe:', 'stripe', nine - 10 * 24 * HOUR, 'board');
  row('greenhouse:airbnb:', 'airbnb', nine - 20 * HOUR, 'board');
  row('greenhouse:stripe:1', 'stripe', nine - 10 * 24 * HOUR);
  row('greenhouse:stripe:2', 'stripe', nine - 20 * HOUR);
  row('greenhouse:stripe:3', 'stripe', nine - 5 * HOUR);
  row('greenhouse:airbnb:1', 'airbnb', nine - 20 * HOUR);
  row('greenhouse:airbnb:2', 'airbnb', nine - 20 * HOUR);
  const follow = (user: string, slug: string) =>
    db.prepare('INSERT INTO company_follows(user_id,company_slug,created_at,last_digest_at) VALUES(?,?,?,?)').run(user, slug, nine - 30 * 24 * HOUR, nine - 24 * HOUR);
  follow('jo-ann', 'stripe');
  follow('jo-ann', 'airbnb');
  follow('jo-ben', 'airbnb');
  follow('jo-cat', 'stripe');
  const notices = (user: string) => db.prepare('SELECT id,kind,title,body,href FROM notifications WHERE user_id=?').all(user);
  assert.equal(await sendCompanyDigest(nine), 2);
  assert.deepEqual(notices('jo-ann'), [
    { id: 'follow-oa:2026-10-15:jo-ann', kind: 'company-oa', title: '关注的公司有 2 条新动态', body: 'Stripe 2', href: '/company/stripe#jobs' },
  ]);
  assert.deepEqual(notices('jo-ben'), []);
  assert.equal(notices('jo-cat').length, 1);
  // Hidden companies send nothing.
  row('greenhouse:stripe:4', 'stripe', nine + 2 * HOUR);
  process.env.HIDDEN_COMPANIES = 'stripe';
  try {
    assert.equal(await sendCompanyDigest(nine + 24 * HOUR), 0);
  } finally {
    delete process.env.HIDDEN_COMPANIES;
  }
});

void test('the digest: a board’s first early-career role, a new season after old rows expired, names outside the OA catalog', async () => {
  const db = sqlite();
  db.prepare('DELETE FROM job_openings').run();
  db.prepare('DELETE FROM company_follows').run();
  // SpaceX and Lyft have company pages but no OA catalog entry.
  const two = { spacex: { ats: 'greenhouse', board: 'spacex' }, lyft: { ats: 'lever', board: 'lyft' } } as const;
  const senior = { id: 1, title: 'Senior Software Engineer', location: { name: 'Hawthorne, CA' }, absolute_url: 'https://example.com/s/1' };
  const intern = (id: string) => ({ id, text: 'Software Engineer Intern', categories: {}, hostedUrl: `https://jobs.lever.co/lyft/${id}` });
  const sync = async (at: number, spacex: unknown[], lyft: unknown[]) => {
    replies = { 'greenhouse.io/v1/boards/spacex/jobs': { jobs: spacex }, 'lever.co/v0/postings/lyft?mode=json': lyft };
    assert.notEqual(await syncJobOpenings(at, two), null);
  };
  const s0 = Date.UTC(2026, 9, 20, 2);
  db.prepare('INSERT INTO company_follows(user_id,company_slug,created_at) VALUES(?,?,?)').run('jo-dan', 'spacex', s0 - 24 * HOUR);
  db.prepare('INSERT INTO company_follows(user_id,company_slug,created_at) VALUES(?,?,?)').run('jo-dan', 'lyft', s0 - 24 * HOUR);
  const notices = () => db.prepare("SELECT title,body,href FROM notifications WHERE user_id='jo-dan' ORDER BY created_at").all();
  // First syncs: SpaceX lists no early-career role, Lyft one intern role; neither is news.
  await sync(s0, [senior], [intern('a1')]);
  // Next day SpaceX posts its first intern role and Lyft's closes.
  await sync(s0 + 21 * HOUR, [senior, { ...senior, id: 2, title: 'Software Engineering Intern', absolute_url: 'https://example.com/s/2' }], []);
  assert.equal(await sendCompanyDigest(Date.UTC(2026, 9, 21, 1)), 1);
  assert.deepEqual(notices(), [{ title: '关注的公司有 1 条新动态', body: 'SpaceX 1', href: '/company/spacex#jobs' }]);
  // A month on, Lyft's old row is gone; its board's row is not, so next season's role is news.
  const s2 = s0 + 31 * 24 * HOUR;
  await sync(s2, [], []);
  assert.deepEqual(db.prepare("SELECT id FROM job_openings WHERE company_slug='lyft'").pluck().all(), ['lever:lyft:']);
  await sync(s2 + 21 * HOUR, [], [intern('b1')]);
  assert.equal(await sendCompanyDigest(Date.UTC(2026, 10, 21, 1)), 1);
  assert.deepEqual(notices()[1], { title: '关注的公司有 1 条新动态', body: 'Lyft 1', href: '/company/lyft#jobs' });
});

void test('seasons: each opening’s own first sighting or title year, kept after the openings expire', async () => {
  const one = { seasonco: { ats: 'lever', board: 'seasonco' } } as const;
  const posting = (id: string, text: string) => ({ id, text, categories: {}, hostedUrl: `https://jobs.lever.co/seasonco/${id}` });
  const sync = async (at: number, list: unknown[]) => {
    replies = { 'lever.co/v0/postings/seasonco?mode=json': list };
    assert.notEqual(await syncJobOpenings(at, one), null);
  };
  const seasons = () =>
    jobSeasons(2000, 'seasonco')
      .map(({ kind, cycle, firstSeenAt, lastSeenAt, peak, firstSync }) => ({ key: `${kind}:${cycle}`, firstSeenAt, lastSeenAt, peak, firstSync }))
      .sort((a, b) => a.key.localeCompare(b.key));
  const june = Date.UTC(2027, 5, 20, 2),
    aug1 = Date.UTC(2027, 7, 1, 2),
    aug5 = Date.UTC(2027, 7, 5, 2),
    aug6 = Date.UTC(2027, 7, 6, 2);
  // The board's first sync: recorded, marked as such.
  await sync(june, [posting('a', 'Software Engineer Intern'), posting('b', 'Software Engineer, New Grad')]);
  // June's intern role is still up in August: it stays in June's cycle, it opens no new one. Two
  // roles open: one with no term (next year's cycle, from August), one naming its own.
  await sync(aug1, [posting('a', 'Software Engineer Intern'), posting('c', 'Software Engineer Intern'), posting('d', 'Software Engineer Intern, Summer 2029')]);
  await sync(aug5, [posting('c', 'Software Engineer Intern'), posting('e', 'Firmware Engineer Intern')]);
  await sync(aug6, [posting('c', 'Software Engineer Intern')]);
  const expected = [
    { key: 'intern:2027', firstSeenAt: june, lastSeenAt: aug1, peak: 1, firstSync: true },
    { key: 'intern:2028', firstSeenAt: aug1, lastSeenAt: aug6, peak: 2, firstSync: false },
    { key: 'intern:2029', firstSeenAt: aug1, lastSeenAt: aug1, peak: 1, firstSync: false },
    { key: 'new-grad:2027', firstSeenAt: june, lastSeenAt: june, peak: 1, firstSync: true },
  ];
  assert.deepEqual(seasons(), expected);
  // Two months on every opening row is gone; the seasons are not.
  await sync(Date.UTC(2027, 9, 6, 2), []);
  assert.deepEqual(sqlite().prepare("SELECT id FROM job_openings WHERE company_slug='seasonco'").pluck().all(), ['lever:seasonco:']);
  assert.deepEqual(seasons(), expected);
  assert.equal(jobSeasons(2028, 'seasonco').length, 2);
  assert.equal(jobSeasons(2027, 'seasonco')[0].boardSeenAt, Date.UTC(2027, 9, 6, 2));
  // Records start with the earliest sync that found an opening (the first test's).
  assert.equal(seasonsSince(), Date.UTC(2026, 9, 12, 1));
});

void test('the digest: a saved search’s new matches, merged with followed-company news in one notice', async () => {
  const db = sqlite();
  db.prepare('DELETE FROM job_openings').run();
  db.prepare('DELETE FROM company_follows').run();
  // Beijing 2027-10-12 09:00.
  const nine = Date.UTC(2027, 9, 12, 1);
  const row = (id: string, company: string, title: string, firstSeen: number, kind = 'intern', unit = '') =>
    db
      .prepare(
        `INSERT INTO job_openings(id,company_slug,title,location,url,kind,first_seen_at,last_seen_at,pay_min,pay_max,pay_currency,pay_unit)
        VALUES(?,?,?,'New York, NY','https://example.com/j',?,?,?,?,?,?,?)`,
      )
      .run(id, company, title, kind, firstSeen, nine - HOUR, unit ? 40 : null, unit ? 50 : null, unit ? 'USD' : '', unit);
  row('greenhouse:stripe:', 'stripe', '', nine - 90 * 24 * HOUR, 'board');
  row('ashby:newco:', 'newco', '', nine - 3 * HOUR, 'board');
  row('greenhouse:stripe:1', 'stripe', 'Software Engineer Intern, Summer 2028', nine - 5 * HOUR, 'intern', 'hour');
  row('greenhouse:stripe:2', 'stripe', 'Marketing Intern', nine - 4 * HOUR);
  row('greenhouse:stripe:3', 'stripe', 'Machine Learning Engineer, New Grad', nine - 30 * HOUR, 'new-grad');
  row('greenhouse:stripe:4', 'stripe', 'Data Engineer, New Grad', nine - 2 * HOUR, 'new-grad');
  // Found by its board's first sync: no news.
  row('ashby:newco:1', 'newco', 'Software Engineer Intern', nine - 3 * HOUR);
  const save = (user: string, search: object | string) =>
    db
      .prepare("INSERT INTO user_notes(user_id,target,body,updated_at) VALUES(?,'career:jobs-search',?,?)")
      .run(user, typeof search === 'string' ? search : JSON.stringify({ ...DEFAULT_SEARCH, ...search }), nine - 50 * 24 * HOUR);
  save('js-amy', { kind: 'intern' }); // stripe:1; marketing is no tech role
  save('js-bob', { role: 'ml' }); // stripe:3 came before the window
  save('js-cat', '{"kind":"boss"}'); // off-shape: skipped
  save('js-dan', { paid: true }); // stripe:1 posts pay
  save('js-eve', { role: 'all', q: 'york' }); // stripe:1, 2 and 4
  db.prepare('INSERT INTO company_follows(user_id,company_slug,created_at,last_digest_at) VALUES(?,?,?,?)').run('js-amy', 'stripe', nine - 60 * 24 * HOUR, nine - 24 * HOUR);
  const notices = (user: string) => db.prepare('SELECT id,kind,title,body,href FROM notifications WHERE user_id=?').all(user);
  assert.equal(await sendCompanyDigest(nine + 5 * 60000), 3);
  // Amy's followed company had three new openings too: one notice says both, the search's side first.
  assert.deepEqual(notices('js-amy'), [
    {
      id: 'jobs:2027-10-12:js-amy',
      kind: 'company-jobs',
      title: '保存的筛选有 1 个新岗位，关注的公司有 3 条新动态',
      body: 'Stripe 1 | Stripe 3',
      href: '/career/jobs?role=tech&kind=intern',
    },
  ]);
  assert.ok(db.prepare("SELECT 1 FROM company_follows WHERE user_id='js-amy' AND last_digest_at=?").get(nine + 5 * 60000), 'the follow moved on');
  assert.deepEqual(notices('js-bob'), []);
  assert.deepEqual(notices('js-cat'), []);
  assert.deepEqual(notices('js-dan'), [
    { id: 'jobs:2027-10-12:js-dan', kind: 'company-jobs', title: '保存的筛选有 1 个新岗位', body: 'Stripe 1', href: '/career/jobs?role=tech&paid=1' },
  ]);
  assert.deepEqual((notices('js-eve') as { body: string; href: string }[]).map((n) => [n.body, n.href]), [['Stripe 3', '/career/jobs?role=all&q=york']]);
  // The day's scan is done: later ticks send nothing.
  assert.equal(await sendCompanyDigest(nine + 15 * 60000), 0);
  assert.equal(englishMessage('保存的筛选有 1 个新岗位'), '1 new opening matches your saved search');
  assert.equal(
    englishMessage('保存的筛选有 2 个新岗位，关注的公司有 3 条新动态'),
    '2 new openings match your saved search; 3 updates at companies you follow',
  );
  // What the page reads back.
  assert.deepEqual(viewerJobSearch('js-amy'), { saved: { ...DEFAULT_SEARCH, kind: 'intern' }, targetRole: '', blocked: [] });
  assert.deepEqual(viewerJobSearch('js-cat'), { saved: null, targetRole: '', blocked: [] });
  for (const body of ['', 'nope', '[]', JSON.stringify({ ...DEFAULT_SEARCH, q: 'x'.repeat(61) }), JSON.stringify({ ...DEFAULT_SEARCH, company: '../x' })])
    assert.equal(parseJobSearch(body), null, body);
});

void test('the digest waits for a running sync round, so rows it stamps before 09:00 are not missed', async () => {
  const db = sqlite();
  db.prepare('DELETE FROM user_notes').run();
  db.prepare('DELETE FROM company_follows').run();
  // Beijing 2028-03-01 09:00; the round starts five minutes before it and is still fetching after.
  const nine = Date.UTC(2028, 2, 1, 1);
  db.prepare("INSERT INTO job_openings(id,company_slug,title,location,url,kind,first_seen_at,last_seen_at) VALUES('greenhouse:waitco:','waitco','','','','board',?,?)").run(
    nine - 90 * 24 * HOUR,
    nine - 24 * HOUR,
  );
  db.prepare('INSERT INTO company_follows(user_id,company_slug,created_at,last_digest_at) VALUES(?,?,?,?)').run('jw-amy', 'waitco', nine - 60 * 24 * HOUR, nine - 24 * HOUR);
  replies = { 'greenhouse.io/v1/boards/waitco/jobs': greenhouse };
  const answer = globalThis.fetch;
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = () => resolve()));
  globalThis.fetch = async (input: string | URL | Request) => {
    await held;
    return answer(input);
  };
  const round = syncJobOpenings(nine - 5 * 60000, { waitco: { ats: 'greenhouse', board: 'waitco' } });
  try {
    assert.equal(await sendCompanyDigest(nine + 60000), 0);
  } finally {
    release();
    globalThis.fetch = answer;
  }
  assert.equal(await round, 2);
  assert.equal(await sendCompanyDigest(nine + 11 * 60000), 1);
  assert.deepEqual(db.prepare("SELECT body FROM notifications WHERE user_id='jw-amy'").pluck().all(), ['waitco 2']);
});

void test('a judged opening keeps its flags; a pay sample is kept once; Greenhouse details stay within the round’s budget', async () => {
  const two = { judgeco: { ats: 'greenhouse', board: 'judgeco' }, paidco: { ats: 'lever', board: 'paidco' } } as const;
  const gh = { jobs: [{ id: 7, title: 'Software Engineer Intern', location: { name: 'Remote' }, absolute_url: 'https://example.com/g/7' }] };
  const lv = (descriptionPlain: string, min: number) => [
    { id: 'p1', text: 'Data Science Intern, Summer 2029', categories: {}, hostedUrl: 'https://jobs.lever.co/paidco/p1', descriptionPlain, salaryRange: { min, max: min + 10, currency: 'USD', interval: 'per-hour-wage' } },
  ];
  const flags = () =>
    Object.fromEntries(sqlite().prepare("SELECT id,auth_flags FROM job_openings WHERE company_slug IN ('judgeco','paidco') AND kind<>'board' ORDER BY id").raw().all() as [string, number][]);
  const s0 = Date.UTC(2028, 3, 1, 2),
    s1 = s0 + 21 * HOUR;
  const from = asked.length;
  replies = {
    'greenhouse.io/v1/boards/judgeco/jobs': gh,
    // Entities inside the escaped HTML are escaped twice.
    'greenhouse.io/v1/boards/judgeco/jobs/7': { id: 7, content: '&lt;ul&gt;&lt;li&gt;Must be a U.S. citizen&lt;/li&gt;&lt;li&gt;We can&amp;rsquo;t sponsor visas&lt;/li&gt;&lt;/ul&gt;' },
    'lever.co/v0/postings/paidco?mode=json': lv('Requires an active Secret clearance.', 40),
  };
  assert.equal(await syncJobOpenings(s0, two), 2);
  assert.deepEqual(flags(), { 'greenhouse:judgeco:7': 3, 'lever:paidco:p1': 4 });
  // Next round: the judged Greenhouse opening is not asked again, and Lever's description is gone
  // (unknown): neither unknown overwrites a judged value. The pay moved on.
  replies = { 'greenhouse.io/v1/boards/judgeco/jobs': gh, 'lever.co/v0/postings/paidco?mode=json': lv('', 60) };
  assert.equal(await syncJobOpenings(s1, two), 2);
  assert.equal(asked.slice(from).filter((url) => url.endsWith('/judgeco/jobs/7')).length, 1);
  assert.deepEqual(flags(), { 'greenhouse:judgeco:7': 3, 'lever:paidco:p1': 4 });
  assert.deepEqual(freshOpenings(s1, 'paidco')[0].pay, { min: 60, max: 70, currency: 'USD', unit: 'hour' });
  // The pay sample is the first range seen, with its role and cycle; an opening without pay has none.
  assert.deepEqual(sqlite().prepare("SELECT * FROM job_pay_samples WHERE company_slug IN ('judgeco','paidco')").all(), [
    { opening_id: 'lever:paidco:p1', company_slug: 'paidco', kind: 'intern', role: 'data', cycle: 2029, unit: 'hour', currency: 'USD', pay_min: 40, pay_max: 50, first_seen_at: s0 },
  ]);
  // A board of 205 new openings: 200 details this round, at most 4 at a time.
  const big = { jobs: Array.from({ length: 205 }, (_, i) => ({ id: 1000 + i, title: 'Software Engineer Intern', location: { name: '' }, absolute_url: `https://example.com/b/${i}` })) };
  replies = { 'greenhouse.io/v1/boards/bigco/jobs': big };
  const answer = globalThis.fetch;
  let open = 0,
    most = 0;
  globalThis.fetch = async (input: string | URL | Request) => {
    open++;
    most = Math.max(most, open);
    await new Promise((resolve) => setTimeout(resolve, 1));
    open--;
    return answer(input);
  };
  const before = asked.length;
  try {
    assert.equal(await syncJobOpenings(s1 + 21 * HOUR, { bigco: { ats: 'greenhouse', board: 'bigco' } }), 205);
  } finally {
    globalThis.fetch = answer;
  }
  assert.equal(asked.slice(before).filter((url) => /\/bigco\/jobs\/\d+$/.test(url)).length, 200);
  assert.equal(most, 4);
});
