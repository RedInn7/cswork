// The application tracker: every row is its owner's alone, a learner keeps at most 300, links
// are https only, and the browser-built exports defuse spreadsheet formulas and remind twice.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
import type { Application } from '../lib/applications';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-applications-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { handleApplications } = await import('../lib/server/applications');
const { APPLICATIONS_MAX, applicationsCsv, csvCell, deadlinesIcs, funnel, countdown } = await import('../lib/applications');

const person = (id: string): Person => ({ id, name: id, email: `${id}@example.test`, role: 'student', verified: true });
const ada = person('app-ada'),
  ben = person('app-ben');

async function call(p: Person | null, path: string[], body?: unknown) {
  const request = new Request('https://cswork.test/api/oj/applications', {
    method: body === undefined ? 'GET' : 'POST',
    ...(body !== undefined && { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
  });
  try {
    const r = await handleApplications(request, p, path);
    return { status: r.status, data: (await r.json()) as { item: Application; items: Application[] } };
  } catch (e) {
    const err = e as { status?: number; name?: string };
    return { status: err.status ?? (err.name === 'ZodError' ? 400 : 500), data: null };
  }
}

before(() => migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') }));
after(() => rmSync(dir, { recursive: true, force: true }));

void test('a learner adds, changes and removes their own applications; a company page name gets its links', async () => {
  assert.equal((await call(null, [])).status, 401);
  const made = await call(ada, [], { company: 'Amazon', role: 'SDE Intern', stage: 'oa', oaDeadline: Date.UTC(2099, 0, 2, 7) });
  assert.equal(made.status, 200);
  const item = made.data!.item;
  assert.equal(item.companySlug, 'amazon');
  assert.equal(item.links?.oa, '/oa/amazon');
  assert.equal(item.links?.mock, '/mock-oa/amazon');
  assert.equal(item.notes, '');
  const other = (await call(ada, [], { company: 'My Startup' })).data!.item;
  assert.deepEqual([other.companySlug, other.stage, other.links], ['', 'applied', null]);

  // An update changes only what it sends.
  const moved = await call(ada, [item.id], { stage: 'phone', interviewAt: Date.UTC(2099, 0, 9) });
  assert.equal(moved.status, 200);
  assert.equal(moved.data!.item.role, 'SDE Intern');
  assert.equal(moved.data!.item.stage, 'phone');
  assert.equal(moved.data!.item.oaDeadline, Date.UTC(2099, 0, 2, 7));
  assert.deepEqual((await call(ada, [])).data!.items.map((a) => a.id), [item.id, other.id]);

  assert.equal((await call(ada, [other.id, 'delete'], {})).status, 200);
  assert.deepEqual((await call(ada, [])).data!.items.map((a) => a.id), [item.id]);
});

void test("nobody reads, changes or deletes another learner's applications", async () => {
  const { item } = (await call(ada, [], { company: 'Google', notes: 'mine' })).data!;
  assert.deepEqual((await call(ben, [])).data!.items, []);
  assert.equal((await call(ben, [item.id], { notes: 'theirs' })).status, 404);
  assert.equal((await call(ben, [item.id, 'delete'], {})).status, 404);
  assert.equal((await call(ada, ['nope'], { notes: 'x' })).status, 404);
  const row = sqlite().prepare('SELECT user_id,notes FROM job_applications WHERE id=?').get(item.id);
  assert.deepEqual(row, { user_id: ada.id, notes: 'mine' });
});

void test('fields are checked: https links only, bounded text, known stages, nothing extra', async () => {
  for (const link of ['http://jobs.example.com/1', 'javascript:alert(1)', 'https://user:pw@example.com/', 'not a url'])
    assert.equal((await call(ada, [], { company: 'Meta', link })).status, 400, link);
  assert.equal((await call(ada, [], { company: 'Meta', link: 'https://www.metacareers.com/jobs/1' })).status, 200);
  assert.equal((await call(ada, [], { company: '' })).status, 400);
  assert.equal((await call(ada, [], { role: 'SWE' })).status, 400, 'company is required');
  assert.equal((await call(ada, [], { company: 'Meta', stage: 'hired' })).status, 400);
  assert.equal((await call(ada, [], { company: 'Meta', notes: 'x'.repeat(2001) })).status, 400);
  assert.equal((await call(ada, [], { company: 'Meta', userId: ben.id })).status, 400);
  assert.equal((await call(ada, [], { company: 'Meta', notes: '记'.repeat(2000) })).status, 200);
});

void test(`a learner keeps at most ${APPLICATIONS_MAX} applications`, async () => {
  const db = sqlite();
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM job_applications WHERE user_id=?').get(ben.id) as { n: number };
  const insert = db.prepare(
    "INSERT INTO job_applications(id,user_id,company_name,stage,created_at,updated_at) VALUES(?,?,'Filler','applied',1,1)",
  );
  for (let i = n; i < APPLICATIONS_MAX - 1; i++) insert.run(`fill-${i}`, ben.id);
  assert.equal((await call(ben, [], { company: 'Last one' })).status, 200);
  assert.equal((await call(ben, [], { company: 'One too many' })).status, 409);
  assert.equal((await call(ben, [])).data!.items.length, APPLICATIONS_MAX);
  assert.equal((await call(ada, [], { company: 'Still fine' })).status, 200, 'the cap is per learner');
});

const row = (patch: Partial<Application>): Application => ({
  id: 'a1', companySlug: '', company: 'Acme', role: '', stage: 'applied', appliedAt: null, oaDeadline: null,
  interviewAt: null, referral: '', link: '', notes: '', createdAt: 0, updatedAt: 0, links: null, ...patch,
});

void test('CSV cells that a spreadsheet would run as formulas are defused', () => {
  for (const v of ['=HYPERLINK("x")', '+1', '-2+3', '@SUM(A1)', '\tx']) assert.ok(csvCell(v).startsWith(`"'`), v);
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  const csv = applicationsCsv([row({ company: '=cmd|calc', notes: 'a,b\nc' })], true);
  assert.ok(csv.startsWith('﻿"Company","Role","Stage"'));
  assert.match(csv, /\r\n"'=cmd\|calc","","Applied"/);
  assert.match(csv, /"a,b\nc"/);
});

void test('the calendar has one event per open OA deadline with reminders a day and two hours before', () => {
  const deadline = Date.UTC(2099, 0, 2, 7, 30);
  const ics = deadlinesIcs(
    [
      row({ id: 'x', company: 'Acme; Inc', role: 'SWE', stage: 'oa', oaDeadline: deadline }),
      row({ id: 'y', stage: 'rejected', oaDeadline: deadline }),
      row({ id: 'z', stage: 'applied' }),
    ],
    'https://cswork.test',
    true,
    Date.UTC(2098, 0, 1),
  );
  assert.equal(ics.match(/BEGIN:VEVENT/g)?.length, 1);
  assert.match(ics, /UID:cswork-application-x@cswork\r\n/);
  assert.match(ics, /DTSTART:20990102T073000Z\r\n/);
  assert.match(ics, /SUMMARY:OA due: Acme\\; Inc · SWE\r\n/);
  assert.match(ics, /TRIGGER:-P1D\r\nEND:VALARM\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:OA due: Acme\\; Inc · SWE\r\nTRIGGER:-PT2H\r\nEND:VALARM\r\nEND:VEVENT/);
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
});

void test('the summary counts sent applications and how far they got', () => {
  const items = [
    row({ stage: 'saved' }),
    row({ stage: 'applied' }),
    row({ stage: 'rejected', oaDeadline: 1 }),
    row({ stage: 'onsite' }),
    row({ stage: 'offer' }),
  ];
  assert.deepEqual(funnel(items), { applied: 4, oa: 3, interview: 2, offers: 1 });
  assert.equal(countdown(1000, 2000, true), null);
  assert.equal(countdown(2 * 86400000 + 3 * 3600000 + 5, 0, false), '2 天 3 小时');
  assert.equal(countdown(90000, 0, true), '1m');
});
