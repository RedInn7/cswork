// Seasons on the pages (lib/server/job-seasons.ts): the company panel's season lines
// (app/company/jobs.tsx), the hiring calendar (app/career/jobs/calendar/page.tsx), and /career/jobs
// opening with a saved search, a profile's target role or ?all=1.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { register } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const dir = mkdtempSync(join(tmpdir(), 'cswork-job-calendar-'));
process.env.DATABASE_PATH = join(dir, 'app.sqlite');
const mocks = {
  'next/headers': `export const cookies = async () => ({ get: (k) => (k === 'cswork_locale' && globalThis.__zh ? { value: 'zh' } : undefined) }); export const headers = async () => new Headers();`,
  '@/lib/server/learner-cloud': `export const reportCompanies = () => [{ slug: 'jane', name: 'Jane Street' }, { slug: 'ramp', name: 'Ramp' }, { slug: 'stripe', name: 'Stripe' }];`,
  '@/lib/server/auth': `export const person = async () => globalThis.__viewer ?? null;`,
  // H-1B data the test switches on and off (globalThis.__h1b), whatever the committed file holds.
  '@/lib/server/h1b': `globalThis.__h1b ??= { updated: null, source: '', sourceUrl: '', fiscalYears: [], companies: {} };
export const H1B = globalThis.__h1b;
export const h1bCompany = (slug) => (Object.hasOwn(H1B.companies, slug) ? H1B.companies[slug] : null);
export const h1bPaths = () => (H1B.fiscalYears.length ? [{ path: '/career/h1b', updatedAt: H1B.updated }] : []);`,
};
// On Node >= 22.22.3, tsx resolves the @/ aliases in-thread (module.registerHooks) before this hook
// runs, so it sees the file URL instead: an @/ mock also matches what its specifier resolves to.
register(
  `data:text/javascript,${encodeURIComponent(`const mocks=${JSON.stringify(mocks)};
export async function resolve(s,c,n){
  if(mocks[s])return {url:'mock:'+s,shortCircuit:true};
  const r=await n(s,c),k=Object.keys(mocks).find((k)=>k.startsWith('@/')&&r.url.endsWith(k.slice(1)+'.ts'));
  return k?{url:'mock:'+k,shortCircuit:true}:r;}
export async function load(u,c,n){
  if(u.startsWith('mock:'))return {format:'module',source:mocks[u.slice(5)],shortCircuit:true};
  if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};
  return n(u,c);}`)}`,
  import.meta.url,
);

const { sqlite } = await import('../db/sqlite.ts');
const { hiringCycle } = await import('../lib/job-tags.ts');
const { JobOpenings } = await import('../app/company/jobs.tsx');
const Calendar = (await import('../app/career/jobs/calendar/page.tsx')).default;
const Jobs = (await import('../app/career/jobs/page.tsx')).default;

const DAY = 86400000;
// A pinned clock, Thursday noon UTC: "this week", the season and "opening soon" never move with the wall clock.
const now = Date.UTC(2026, 9, 15, 12);
Date.now = () => now;
const cycle = hiringCycle(now);
const SWE = `Software Engineer Intern, Summer ${cycle}`;
before(() => {
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
  const db = sqlite();
  const opening = db.prepare(
    'INSERT INTO job_openings(id,company_slug,title,location,url,kind,first_seen_at,last_seen_at,pay_min,pay_max,pay_currency,pay_unit) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
  );
  const board = (id, slug, first, last) => opening.run(id, slug, '', '', '', 'board', first, last, null, null, '', '');
  board('greenhouse:stripe:', 'stripe', now - 40 * DAY, now - 2 * 3600000);
  board('lever:ramp:', 'ramp', now - 400 * DAY, now - 3600000);
  // First seen a minute ago, so each is this hiring cycle's whatever the date.
  opening.run('greenhouse:stripe:1', 'stripe', SWE, 'New York, NY', 'https://stripe.com/jobs?gh_jid=1', 'intern', now - 60000, now - 2 * 3600000, 45, 55, 'USD', 'hour');
  opening.run('greenhouse:stripe:2', 'stripe', 'Marketing Intern', 'San Francisco', 'https://stripe.com/jobs?gh_jid=2', 'intern', now - 60000, now - 2 * 3600000, null, null, '', '');
  opening.run('greenhouse:stripe:3', 'stripe', 'Machine Learning Engineer, New Grad', 'Seattle', 'https://stripe.com/jobs?gh_jid=3', 'new-grad', now - 30000, now - 2 * 3600000, null, null, '', '');
  // Old Co (no company page): last cycle's new-grad posting is still up; this cycle's came and went.
  board('greenhouse:oldco:', 'oldco', now - 400 * DAY, now - 3600000);
  opening.run('greenhouse:oldco:1', 'oldco', `Software Engineer, New Grad ${cycle - 1}`, 'Austin', 'https://example.com/old/1', 'new-grad', now - 300 * DAY, now - 2 * 3600000, null, null, '', '');
  const season = db.prepare('INSERT INTO job_seasons(company_slug,kind,cycle,first_seen_at,last_seen_at,peak) VALUES(?,?,?,?,?,?)');
  // Stripe: interns this week-ish; new grads already up at the first sync.
  season.run('stripe', 'intern', cycle, now - 3 * DAY, now - 2 * 3600000, 2);
  season.run('stripe', 'new-grad', cycle, now - 40 * DAY, now - 2 * 3600000, 3);
  // Ramp: last season's interns opened ten days from now a year ago; this season's new grads came and went.
  season.run('ramp', 'intern', cycle - 1, now + 10 * DAY - 365 * DAY, now - 300 * DAY, 4);
  season.run('ramp', 'new-grad', cycle, now - 20 * DAY, now - 10 * DAY, 1);
  // Jane Street: seen once today; its board has no row (it failed since), so nothing is called closed.
  season.run('jane', 'intern', cycle, now - 60000, now - 60000, 1);
  season.run('oldco', 'new-grad', cycle - 1, now - 300 * DAY, now - 2 * 3600000, 1);
  season.run('oldco', 'new-grad', cycle, now - 20 * DAY, now - 10 * DAY, 1);
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

const doc = (element) => new JSDOM(`<main>${renderToStaticMarkup(element)}</main>`).window.document;
const lines = (d) => [...d.querySelectorAll('.job-seasons li')].map((li) => li.textContent);

test('the company panel: this and last season, open or closed, and only when there is something to say', async () => {
  globalThis.__zh = false;
  const stripe = doc(await JobOpenings({ slug: 'stripe', name: 'Stripe', zh: false }));
  assert.match(lines(stripe)[0], new RegExp(`^This season's intern roles \\(${cycle} start\\) first appeared \\w{3} \\d{1,2} · 2 open now$`));
  assert.match(lines(stripe)[1], /^This season's new-grad roles .* \(already up at our first sync; they may have opened earlier\) · 1 open now$/);
  assert.equal(stripe.querySelectorAll('.job-openings > li').length, 3);
  // No openings now: the seasons still show, and a closed season says since when.
  const ramp = doc(await JobOpenings({ slug: 'ramp', name: 'Ramp', zh: false }));
  assert.match(lines(ramp)[0], new RegExp(`^No intern roles yet this season \\(${cycle} start\\) · Last season: first appeared \\w{3} \\d{1,2}$`));
  assert.match(lines(ramp)[1], /new-grad roles .* first appeared \w{3} \d{1,2} · all closed since \w{3} \d{1,2}$/);
  assert.equal(ramp.querySelector('.job-openings'), null);
  const jane = doc(await JobOpenings({ slug: 'jane', name: 'Jane Street', zh: true }));
  assert.match(lines(jane)[0], new RegExp(`^本季实习岗位（${cycle} 年入职）\\d{1,2} 月 \\d{1,2} 日首次出现$`));
  // Last cycle's posting still up is no open role this season, nor does it keep the season from closing.
  const oldco = doc(await JobOpenings({ slug: 'oldco', name: 'Old Co', zh: false }));
  assert.match(lines(oldco)[0], /^This season's new-grad roles .* first appeared \w{3} \d{1,2} · all closed since \w{3} \d{1,2} · Last season: first appeared \w{3} \d{1,2}$/);
  assert.equal(oldco.querySelectorAll('.job-openings > li').length, 1);
  assert.equal(await JobOpenings({ slug: 'nobody', name: 'Nobody', zh: false }), null);
});

test('the calendar: this week first, then opening soon, then earlier weeks and the first sync', async () => {
  globalThis.__zh = false;
  const d = doc(await Calendar());
  const headings = [...d.querySelectorAll('h2')].map((h) => h.textContent);
  assert.equal(headings[0], 'New this week');
  assert.equal(headings[1], 'Opening soon: up around now last year, not yet this year');
  assert.ok(headings.includes('Already up at our first sync (they may have opened earlier)'));
  const [thisWeek, soon] = d.querySelectorAll('.job-calendar-section');
  assert.match(thisWeek.textContent, /Jane Street/);
  assert.match(soon.textContent, /Ramp last year \w{3} \d{1,2}/);
  // Records start with the earliest season (Ramp's), stated as such.
  assert.match(d.querySelector('.job-openings-note').textContent, new RegExp(`a ${cycle} start\\. Records begin on ${new Date(now + 10 * DAY - 365 * DAY).toISOString().slice(0, 10)}`));
  globalThis.__zh = true;
  assert.equal(doc(await Calendar()).querySelector('h2').textContent, '本周新开放');
});

test('/career/jobs: tech roles by default, a saved search or the profile role when opened bare, ?all=1 for everything', async () => {
  globalThis.__zh = false;
  const titles = async (query) => [...doc(await Jobs({ searchParams: Promise.resolve(query) })).querySelectorAll('.job-openings-title')].map((a) => a.textContent);
  globalThis.__viewer = null;
  assert.deepEqual(await titles({}), ['Machine Learning Engineer, New Grad', SWE]);
  assert.deepEqual(await titles({ role: 'all' }), ['Machine Learning Engineer, New Grad', SWE, 'Marketing Intern']);
  assert.deepEqual(await titles({ role: 'tech', paid: '1' }), [SWE]);
  assert.deepEqual(await titles({ role: 'all', term: `summer-${cycle}` }), [SWE]);
  // No H-1B data: no H-1B filter, and its parameter is ignored.
  const page = doc(await Jobs({ searchParams: Promise.resolve({ h1b: '1' }) }));
  assert.equal(page.querySelector('input[name="h1b"]'), null);
  assert.equal(page.querySelectorAll('.job-openings-title').length, 2);
  // With data: the filter shows, ?h1b=1 keeps sponsors' roles only, and each carries the badge.
  const year = (newApproved) => ({ years: [{ fy: 2025, newApproved, newDenied: 0, contApproved: 0, contDenied: 0 }], employers: [] });
  Object.assign(globalThis.__h1b, { updated: '2026-10-17', fiscalYears: [2025], companies: { stripe: year(1200) } });
  const sponsored = doc(await Jobs({ searchParams: Promise.resolve({ h1b: '1' }) }));
  assert.ok(sponsored.querySelector('input[name="h1b"][checked]'));
  assert.deepEqual([...sponsored.querySelectorAll('.job-openings-title')].map((a) => a.textContent), ['Machine Learning Engineer, New Grad', SWE]);
  assert.match(sponsored.querySelector('.job-openings-facts').textContent, /H-1B: 1,200 new approvals in FY2025/);
  globalThis.__h1b.companies = { ramp: year(50) };
  assert.deepEqual(await titles({ h1b: '1' }), []);
  Object.assign(globalThis.__h1b, { updated: null, fiscalYears: [], companies: {} });
  // Signed in with a target role: it picks the role filter, and says so.
  const db = sqlite();
  db.prepare("INSERT INTO user_profiles(user_id,handle,target_role,created_at,updated_at) VALUES('u1','u-one','ML engineer',1,1)").run();
  globalThis.__viewer = { id: 'u1' };
  const profiled = doc(await Jobs({ searchParams: Promise.resolve({}) }));
  assert.match(profiled.querySelector('.job-search-applied').textContent, /Showing ML \/ AI roles, from the target role in your profile/);
  assert.equal(profiled.querySelector('select[name="role"] option[selected]').value, 'ml');
  assert.deepEqual([...profiled.querySelectorAll('.job-openings-title')].map((a) => a.textContent), ['Machine Learning Engineer, New Grad']);
  // A saved search wins when the page is opened bare; any query or ?all=1 skips it.
  db.prepare("INSERT INTO user_notes(user_id,target,body,updated_at) VALUES('u1','career:jobs-search',?,1)").run(
    JSON.stringify({ kind: 'intern', role: 'all', term: '', q: '', company: '', paid: false }),
  );
  const saved = doc(await Jobs({ searchParams: Promise.resolve({}) }));
  assert.match(saved.querySelector('.job-search-applied').textContent, /Showing your saved search\. See all openings/);
  assert.equal(saved.querySelector('.job-search-applied a').getAttribute('href'), '/career/jobs?all=1');
  assert.deepEqual([...saved.querySelectorAll('.job-openings-title')].map((a) => a.textContent), [SWE, 'Marketing Intern']);
  assert.match(saved.querySelector('.job-search-save').textContent, /^Saved/);
  assert.equal((await titles({ all: '1' })).length, 3);
  assert.match(doc(await Jobs({ searchParams: Promise.resolve({ all: '1' }) })).querySelector('.job-search-save button').textContent, /Replace my saved search/);
  globalThis.__viewer = null;
});
