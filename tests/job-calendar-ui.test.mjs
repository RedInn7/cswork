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
};
register(
  `data:text/javascript,${encodeURIComponent(`const mocks=${JSON.stringify(mocks)};
export async function resolve(s,c,n){if(mocks[s])return {url:'mock:'+s,shortCircuit:true};return n(s,c);}
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
const now = Date.now();
const cycle = hiringCycle(now);
before(() => {
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
  const db = sqlite();
  const opening = db.prepare(
    'INSERT INTO job_openings(id,company_slug,title,location,url,kind,first_seen_at,last_seen_at,pay_min,pay_max,pay_currency,pay_unit) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
  );
  const board = (id, slug, first, last) => opening.run(id, slug, '', '', '', 'board', first, last, null, null, '', '');
  board('greenhouse:stripe:', 'stripe', now - 40 * DAY, now - 2 * 3600000);
  board('lever:ramp:', 'ramp', now - 400 * DAY, now - 3600000);
  opening.run('greenhouse:stripe:1', 'stripe', 'Software Engineer Intern, Summer 2027', 'New York, NY', 'https://stripe.com/jobs?gh_jid=1', 'intern', now - 3 * DAY, now - 2 * 3600000, 45, 55, 'USD', 'hour');
  opening.run('greenhouse:stripe:2', 'stripe', 'Marketing Intern', 'San Francisco', 'https://stripe.com/jobs?gh_jid=2', 'intern', now - 3 * DAY, now - 2 * 3600000, null, null, '', '');
  opening.run('greenhouse:stripe:3', 'stripe', 'Machine Learning Engineer, New Grad', 'Seattle', 'https://stripe.com/jobs?gh_jid=3', 'new-grad', now - 2 * DAY, now - 2 * 3600000, null, null, '', '');
  const season = db.prepare('INSERT INTO job_seasons(company_slug,kind,cycle,first_seen_at,last_seen_at,peak) VALUES(?,?,?,?,?,?)');
  // Stripe: interns this week-ish; new grads already up at the first sync.
  season.run('stripe', 'intern', cycle, now - 3 * DAY, now - 2 * 3600000, 2);
  season.run('stripe', 'new-grad', cycle, now - 40 * DAY, now - 2 * 3600000, 3);
  // Ramp: last season's interns opened ten days from now a year ago; this season's new grads came and went.
  season.run('ramp', 'intern', cycle - 1, now + 10 * DAY - 365 * DAY, now - 300 * DAY, 4);
  season.run('ramp', 'new-grad', cycle, now - 20 * DAY, now - 10 * DAY, 1);
  // Jane Street: seen once today; its board has no row (it failed since), so nothing is called closed.
  season.run('jane', 'intern', cycle, now - 60000, now - 60000, 1);
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
  assert.deepEqual(await titles({}), ['Machine Learning Engineer, New Grad', 'Software Engineer Intern, Summer 2027']);
  assert.deepEqual(await titles({ role: 'all' }), ['Machine Learning Engineer, New Grad', 'Software Engineer Intern, Summer 2027', 'Marketing Intern']);
  assert.deepEqual(await titles({ role: 'tech', paid: '1' }), ['Software Engineer Intern, Summer 2027']);
  assert.deepEqual(await titles({ role: 'all', term: 'summer-2027' }), ['Software Engineer Intern, Summer 2027']);
  // No H-1B data: no H-1B filter, and its parameter is ignored.
  const page = doc(await Jobs({ searchParams: Promise.resolve({ h1b: '1' }) }));
  assert.equal(page.querySelector('input[name="h1b"]'), null);
  assert.equal(page.querySelectorAll('.job-openings-title').length, 2);
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
  assert.deepEqual([...saved.querySelectorAll('.job-openings-title')].map((a) => a.textContent), ['Software Engineer Intern, Summer 2027', 'Marketing Intern']);
  assert.match(saved.querySelector('.job-search-save').textContent, /^Saved/);
  assert.equal((await titles({ all: '1' })).length, 3);
  assert.match(doc(await Jobs({ searchParams: Promise.resolve({ all: '1' }) })).querySelector('.job-search-save button').textContent, /Replace my saved search/);
  globalThis.__viewer = null;
});
