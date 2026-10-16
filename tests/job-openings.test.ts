// New-grad and intern openings (lib/server/job-openings.ts): parsing the three ATS boards' JSON,
// the title filter, the 20-hour sync throttle, hiding stale openings and hidden companies, and the
// openings in the followed-company digest (lib/server/company-follows.ts).
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
const { BOARDS, boardOpenings, freshOpenings, openingKind, syncJobOpenings } = await import('../lib/server/job-openings');
const { sendCompanyDigest } = await import('../lib/server/company-follows');

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
    { id: 'greenhouse:acme:101', companySlug: 'acme', title: 'Software Engineer, New Grad', location: 'Seattle, WA', url: 'https://example.com/jobs?gh_jid=101', kind: 'new-grad', postedAt: Date.parse('2026-10-01T13:00:00Z') },
    // 103 is http: left out. A date that does not parse is no date.
    { id: 'greenhouse:acme:104', companySlug: 'acme', title: 'Data Science Intern', location: 'Austin, TX', url: 'https://example.com/jobs?gh_jid=104', kind: 'intern', postedAt: null },
  ]);
  // Credentials in the link: left out.
  assert.deepEqual(boardOpenings('acme', { ats: 'lever', board: 'acme' }, lever), [
    { id: 'lever:acme:a1', companySlug: 'acme', title: 'Forward Deployed Engineer, Internship', location: 'London', url: 'https://jobs.lever.co/acme/a1', kind: 'intern', postedAt: 1790000000000 },
  ]);
  // Unlisted Ashby postings are left out; whitespace in titles is tidied.
  assert.deepEqual(boardOpenings('acme', { ats: 'ashby', board: 'acme' }, ashby), [
    { id: 'ashby:acme:u1', companySlug: 'acme', title: 'Software Engineer, University Graduate', location: 'San Francisco', url: 'https://jobs.ashbyhq.com/acme/u1', kind: 'new-grad', postedAt: Date.parse('2026-10-10T00:00:00Z') },
  ]);
  // Junk is no opening, never an exception.
  for (const body of [null, 'oops', { jobs: 'x' }, [{ id: 1 }], { ok: false, error: 'Document not found' }])
    for (const ats of ['greenhouse', 'lever', 'ashby'] as const) assert.deepEqual(boardOpenings('acme', { ats, board: 'acme' }, body), []);
  // A link too long for the tracker's link field is left out.
  const long = { jobs: [{ ...greenhouse.jobs[0], absolute_url: `https://example.com/${'x'.repeat(500)}` }] };
  assert.deepEqual(boardOpenings('acme', { ats: 'greenhouse', board: 'acme' }, long), []);
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
const asked: string[] = [];
globalThis.fetch = async (input: string | URL | Request) => {
  const url = String(input);
  asked.push(url);
  if (url.includes('/downco/')) throw new Error('network down');
  const reply = Object.entries(replies).find(([part]) => url.includes(part));
  return reply ? Response.json(reply[1]) : Response.json({ ok: false }, { status: 404 });
};

void test('sync: at most every 20 hours, a failed board skipped, stale openings hidden', async () => {
  const t0 = Date.UTC(2026, 9, 12, 1);
  replies = { 'greenhouse.io/v1/boards/acme/jobs': greenhouse, 'lever.co/v0/postings/leverco?mode=json': lever, 'ashbyhq.com/posting-api/job-board/ashco': ashby };
  assert.equal(await syncJobOpenings(t0, boards), 4);
  assert.equal(asked.length, 4);
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
  assert.equal(asked.length, 4);
  // Next day: Acme's new-grad posting is gone, the Lever board fails; both keep their old rows.
  replies = { 'greenhouse.io/v1/boards/acme/jobs': { jobs: greenhouse.jobs.slice(1) }, 'ashbyhq.com/posting-api/job-board/ashco': ashby };
  const t1 = t0 + 21 * HOUR;
  assert.equal(await syncJobOpenings(t1, boards), 2);
  assert.equal(asked.length, 8);
  const first = sqlite().prepare('SELECT first_seen_at AS f,last_seen_at AS l FROM job_openings WHERE id=?');
  assert.deepEqual(first.get('ashby:ashco:u1'), { f: t0, l: t1 });
  assert.deepEqual(first.get('greenhouse:acme:101'), { f: t0, l: t0 });
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
