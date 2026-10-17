// The application tracker: every row is its owner's alone, a learner keeps at most 300, links
// are https only, and the browser-built exports defuse spreadsheet formulas and remind twice.
// Stage moves are logged (capped), the job description stays out of the list, a posting its
// board stopped listing reads as closed, and the stats and stale checks read the log. Offer
// deadlines (Offer stage only) feed the calendar, schedule clashes and the expedite plan.
// Wave 10: the company tier (and its CSV column), the warm-up order check, and a deleted card
// taking its interview retros with it.
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
const { APPLICATIONS_MAX, applicationsCsv, applicationsIcs, calendarItems, csvCell, DAY, expeditePlan, funnel, countdown, medianDays, scheduleIssues, stageDays, stale, followUpDue, trackerStats, warmupIssues, weekStart, writeUpHref } =
  await import('../lib/applications');

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
  interviewAt: null, offerDeadline: null, process: null, referral: '', link: '', notes: '', channel: '', referralStatus: '', nextAction: '', nextAt: null,
  resumeVersion: '', tier: '', stageLog: [], hasJd: false, createdAt: 0, updatedAt: 0, links: null, closedAt: null, prep: null, ...patch,
});

void test('CSV cells that a spreadsheet would run as formulas are defused', () => {
  for (const v of ['=HYPERLINK("x")', '+1', '-2+3', '@SUM(A1)', '\tx']) assert.ok(csvCell(v).startsWith(`"'`), v);
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  const csv = applicationsCsv([row({ company: '=cmd|calc', notes: 'a,b\nc' })], true);
  assert.ok(csv.startsWith('﻿"Company","Role","Stage"'));
  assert.match(csv, /\r\n"'=cmd\|calc","","Applied"/);
  assert.match(csv, /"a,b\nc"/);
});

void test('the calendar has one event per OA deadline still ahead, with reminders a day and two hours before', () => {
  const deadline = Date.UTC(2099, 0, 2, 7, 30);
  const ics = applicationsIcs(
    [
      row({ id: 'x', company: 'Acme; Inc', role: 'SWE', stage: 'oa', oaDeadline: deadline }),
      row({ id: 'y', stage: 'rejected', oaDeadline: deadline }),
      row({ id: 'z', stage: 'applied' }),
      // Past the OA (the deadline no longer matters) or already passed: no event, no reminder.
      row({ id: 'p', stage: 'phone', oaDeadline: deadline }),
      row({ id: 'old', stage: 'oa', oaDeadline: Date.UTC(2097, 0, 1) }),
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

void test('stage moves are logged from creation, only when the stage changes, the newest 40 kept', async () => {
  const before = Date.now();
  const { item } = (await call(ada, [], { company: 'Logco', stage: 'applied' })).data!;
  assert.equal(item.stageLog.length, 1);
  assert.equal(item.stageLog[0][0], 'applied');
  assert.ok(item.stageLog[0][1] >= before);
  const oa = (await call(ada, [item.id], { stage: 'oa' })).data!.item;
  assert.deepEqual(oa.stageLog.map(([s]) => s), ['applied', 'oa']);
  // Notes, or the same stage sent again, add nothing.
  assert.equal((await call(ada, [item.id], { notes: 'n', stage: 'oa' })).data!.item.stageLog.length, 2);
  const full = Array.from({ length: 40 }, (_, i) => [i % 2 ? 'oa' : 'phone', i]);
  sqlite().prepare('UPDATE job_applications SET stage=?,stage_log=? WHERE id=?').run('oa', JSON.stringify(full), item.id);
  const capped = (await call(ada, [item.id], { stage: 'onsite' })).data!.item.stageLog;
  assert.equal(capped.length, 40);
  assert.deepEqual(capped[0], ['oa', 1]);
  assert.equal(capped.at(-1)![0], 'onsite');
});

void test('the job description is private, out of the list, and read one card at a time', async () => {
  const jd = '职'.repeat(10000);
  const made = await call(ada, [], { company: 'JD Co', jdText: jd, channel: 'referral', referralStatus: 'agreed', resumeVersion: 'Backend' });
  assert.equal(made.status, 200, '10 000 Chinese characters fit the body cap');
  const { item } = made.data!;
  assert.equal(item.hasJd, true);
  assert.equal('jdText' in item, false);
  assert.deepEqual([item.channel, item.referralStatus, item.resumeVersion], ['referral', 'agreed', 'Backend']);
  const listed = (await call(ada, [])).data!.items.find((a) => a.id === item.id)!;
  assert.equal(listed.hasJd, true);
  assert.equal(JSON.stringify(listed).includes('职职'), false);
  const read = await call(ada, [item.id, 'jd']);
  assert.equal((read.data as unknown as { jd: string }).jd, jd);
  assert.equal((await call(ben, [item.id, 'jd'])).status, 404);
  assert.equal((await call(ada, [item.id])).status, 404);
  assert.equal((await call(ada, [item.id, 'other'])).status, 404);
  assert.equal((await call(ada, [item.id], { jdText: '' })).data!.item.hasJd, false);
  assert.equal((await call(ada, [], { company: 'JD Co', jdText: 'x'.repeat(10001) })).status, 400);
  for (const bad of [{ channel: 'bogus' }, { channel: 'constructor' }, { referralStatus: 'maybe' }, { nextAction: 'x'.repeat(121) }])
    assert.equal((await call(ada, [], { company: 'JD Co', ...bad })).status, 400, JSON.stringify(bad));
  const next = await call(ada, [item.id], { nextAt: Date.UTC(2099, 0, 1), nextAction: 'Ping the recruiter' });
  assert.deepEqual([next.data!.item.nextAt, next.data!.item.nextAction], [Date.UTC(2099, 0, 1), 'Ping the recruiter']);
  assert.equal((await call(ada, [item.id], { nextAt: null })).data!.item.nextAt, null);
});

void test('a posting reads as closed only once its board synced without it; links match without tracking noise', async () => {
  const add = sqlite().prepare(
    'INSERT INTO job_openings(id,company_slug,title,location,url,kind,first_seen_at,last_seen_at) VALUES(?,?,?,?,?,?,?,?)',
  );
  add.run('greenhouse:acme:', 'acme', '', '', '', 'board', 1, 2000);
  add.run('greenhouse:acme:1', 'acme', 'SWE Intern', '', 'https://boards.greenhouse.io/acme/jobs/1', 'intern', 1, 1000);
  add.run('greenhouse:acme:2', 'acme', 'SWE Intern 2', '', 'https://boards.greenhouse.io/acme/jobs/2', 'intern', 1, 2000);
  add.run('greenhouse:acme:7', 'acme', 'New Grad', '', 'https://careers.acme.com/open?gh_jid=7', 'new-grad', 1, 1000);
  // A board whose last fetch failed: its board row is as old as its postings, so nothing closed.
  add.run('lever:down:', 'down', '', '', '', 'board', 1, 1000);
  add.run('lever:down:x', 'down', 'Intern', '', 'https://jobs.lever.co/down/x', 'intern', 1, 1000);
  const closedAt = async (link: string) => (await call(ada, [], { company: 'Closeco', link })).data!.item.closedAt;
  assert.equal(await closedAt('https://boards.greenhouse.io/acme/jobs/1/?utm_source=x#apply'), 1000);
  assert.equal(await closedAt('https://boards.greenhouse.io/acme/jobs/1'), 1000);
  assert.equal(await closedAt('https://boards.greenhouse.io/acme/jobs/2?utm_source=x'), null);
  assert.equal(await closedAt('https://careers.acme.com/open?utm_medium=y&gh_jid=7'), 1000);
  assert.equal(await closedAt('https://careers.acme.com/open?gh_jid=8'), null, 'another job on the same page');
  assert.equal(await closedAt('https://jobs.lever.co/down/x'), null);
  assert.equal(await closedAt('https://example.com/unknown'), null);
});

void test('cards at OA, phone or onsite get the interview prep links', async () => {
  // One approved member write-up (the content library may be absent here: then it is the count).
  const library = (await import('../lib/server/content-library')).library();
  const before = library ? (await import('../lib/server/company-hub')).companyDirectory(library).get('amazon')?.experiences ?? 0 : 0;
  sqlite()
    .prepare(
      `INSERT INTO experience_submissions(id,user_id,company_slug,title,role,interview_month,body,status,created_at)
      VALUES('xp-1','someone','amazon','Phone screen','SDE','2026-09',?,'approved',1)`,
    )
    .run('x'.repeat(100));
  const { item } = (await call(ada, [], { company: 'Amazon', stage: 'phone' })).data!;
  assert.equal(item.prep?.problems, '/?view=problems&company=amazon&sort=frequency');
  assert.equal(item.prep?.stories, '/?view=stories');
  assert.deepEqual(item.prep?.experiences, { href: '/company/amazon#experiences', n: before + 1 });
  assert.equal((await call(ada, [item.id], { stage: 'offer' })).data!.item.prep, null);
  assert.equal((await call(ada, [], { company: 'My Startup', stage: 'oa' })).data!.item.prep, null);
});

void test('time per stage, the median wait for an OA, stale cards and follow-up nudges', () => {
  const now = 100 * DAY;
  assert.deepEqual(stageDays(row({ stageLog: [['applied', 0], ['oa', 3 * DAY]] }), 5 * DAY), [
    { stage: 'applied', at: 0, days: 3 },
    { stage: 'oa', at: 3 * DAY, days: 2 },
  ]);
  const log = (...moves: [Application['stage'], number][]) => row({ stageLog: moves.map(([s, d]) => [s, d * DAY]) });
  assert.equal(medianDays([log(['applied', 0], ['oa', 4]), log(['applied', 0], ['phone', 1])], 'applied', 'oa'), 4);
  assert.equal(
    medianDays([log(['applied', 0], ['oa', 4]), log(['applied', 0], ['oa', 10]), log(['applied', 0], ['oa', 6]), log(['oa', 1]), log(['saved', 0], ['applied', 1], ['oa', 3])], 'applied', 'oa'),
    5,
  );
  assert.equal(medianDays([log(['oa', 1], ['applied', 2])], 'applied', 'oa'), null);

  const waiting = (days: number, patch: Partial<Application> = {}) => row({ stageLog: [['applied', now - days * DAY]], ...patch });
  assert.equal(stale(waiting(22), now), true);
  assert.equal(stale(waiting(20), now), false);
  assert.equal(stale(waiting(22, { stage: 'rejected' }), now), false);
  assert.equal(stale(waiting(22, { stage: 'oa', oaDeadline: now + DAY }), now), false, 'an OA still due is not stale');
  assert.equal(stale(waiting(22, { stage: 'phone', interviewAt: now + DAY }), now), false);
  assert.equal(stale(waiting(22, { stage: 'phone', interviewAt: now - DAY }), now), true);
  // Before the log: updated_at, never earlier than the real move.
  assert.equal(stale(row({ updatedAt: now - 30 * DAY }), now), true);
  assert.equal(stale(row({ updatedAt: now - DAY, createdAt: now - 60 * DAY }), now), false);
  // Added after applying: the applied date counts.
  assert.equal(stale(waiting(1, { appliedAt: now - 30 * DAY }), now), true);
  assert.equal(followUpDue(waiting(8), now), true);
  assert.equal(followUpDue(waiting(6), now), false);
  assert.equal(followUpDue(waiting(8, { nextAt: now + DAY }), now), false);
  assert.equal(followUpDue(waiting(8, { stage: 'oa' }), now), false);
  assert.equal(followUpDue(waiting(22), now), false, 'a stale card gets the stale hint instead');
  assert.equal(followUpDue(waiting(8, { updatedAt: now }), now), false, 'a follow-up just marked done waits another week');
  assert.equal(followUpDue(waiting(15, { updatedAt: now - 8 * DAY }), now), true);
});

void test('stats: reply rate per channel, days per stage, where rejections come, the weekly goal streak', () => {
  const now = new Date(2026, 9, 15, 12).getTime(); // a Thursday
  const monday = weekStart(now);
  assert.equal(new Date(monday).getDay(), 1);
  assert.equal(new Date(monday).getHours(), 0);
  const back = (weeks: number) => weekStart(monday - weeks * 7 * DAY + 3 * DAY) + DAY;
  const items = [
    row({ channel: 'referral', stage: 'oa', appliedAt: back(0) }),
    row({ channel: 'referral', stage: 'applied', appliedAt: back(0) }),
    row({ channel: 'online', stage: 'rejected', appliedAt: back(1), stageLog: [['applied', back(1)], ['phone', back(1) + 2 * DAY], ['rejected', back(1) + 3 * DAY]] }),
    row({ channel: 'online', stage: 'rejected', appliedAt: back(2), stageLog: [['applied', back(2)], ['rejected', back(2) + 4 * DAY]] }),
    row({ channel: 'online', stage: 'applied', appliedAt: back(2) }),
    row({ stage: 'saved' }),
  ];
  const s = trackerStats(items, now, 1);
  assert.deepEqual(s.channels, [
    { channel: 'online', sent: 3, replied: 1 },
    { channel: 'referral', sent: 2, replied: 1 },
  ]);
  assert.deepEqual(s.stays.map((x) => [x.stage, x.days, x.n]), [['applied', 3, 2], ['phone', 1, 1]]);
  assert.deepEqual(s.rejectedAfter, [{ stage: 'applied', n: 1 }, { stage: 'phone', n: 1 }]);
  assert.equal(s.thisWeek, 2);
  assert.equal(s.streak, 3);
  assert.equal(trackerStats(items, now, 2).streak, 1, 'weeks with one application break a goal of two');
  assert.equal(trackerStats(items, now, 3).streak, 0);
  assert.equal(trackerStats(items.slice(2), now, 1).streak, 2, 'a week not yet met counts from the last one');
});

void test('the calendar adds interviews (an hour before) and follow-ups, each with its own UID', () => {
  const now = Date.UTC(2098, 0, 1);
  const ics = applicationsIcs(
    [
      row({ id: 'x', company: 'Acme', stage: 'oa', oaDeadline: Date.UTC(2099, 0, 2), interviewAt: Date.UTC(2099, 0, 9, 17), nextAt: Date.UTC(2099, 0, 5, 9), nextAction: 'Thank-you note' }),
      row({ id: 'r', stage: 'rejected', interviewAt: Date.UTC(2099, 0, 9) }),
      row({ id: 'g', stage: 'ghosted', interviewAt: Date.UTC(2099, 0, 9), nextAt: Date.UTC(2099, 0, 6) }),
    ],
    'https://cswork.test',
    true,
    now,
  );
  assert.equal(ics.match(/BEGIN:VEVENT/g)?.length, 3);
  assert.match(ics, /UID:cswork-application-x@cswork\r\nDTSTAMP:\d+T\d+Z\r\nDTSTART:20990102T000000Z\r\nSUMMARY:OA due: Acme/);
  assert.match(ics, /UID:cswork-application-x-interview@cswork\r\nDTSTAMP:\d+T\d+Z\r\nDTSTART:20990109T170000Z\r\nDURATION:PT1H\r\nSUMMARY:Interview: Acme\r\n[\s\S]*?TRIGGER:-PT1H\r\nEND:VALARM\r\nEND:VEVENT/);
  assert.match(ics, /UID:cswork-application-x-next@cswork\r\nDTSTAMP:\d+T\d+Z\r\nDTSTART:20990105T090000Z\r\nSUMMARY:Follow up: Acme · Thank-you note\r\n/);
  assert.doesNotMatch(ics, /application-[rg]/);
});

void test('the write-up link carries company, role, internship or not and the season of the interview', () => {
  const href = writeUpHref(row({ companySlug: 'amazon', role: 'SDE Intern', interviewAt: new Date(2026, 9, 3).getTime() }));
  assert.equal(href, '/?view=progress&tab=share&company=amazon&role=SDE+Intern&employment=intern&season=2026-fall');
  assert.equal(writeUpHref(row({ interviewAt: new Date(2027, 0, 9).getTime() })), '/?view=progress&tab=share&employment=fulltime&season=2027-winter');
  assert.equal(writeUpHref(row({ role: '后端实习' })), '/?view=progress&tab=share&role=%E5%90%8E%E7%AB%AF%E5%AE%9E%E4%B9%A0&employment=intern');
  for (const role of ['Internal Tools Engineer', 'International Payments SWE']) assert.match(writeUpHref(row({ role })), /employment=fulltime/, role);
  for (const role of ['Interns Program', 'Summer Internships', 'intern - SWE']) assert.match(writeUpHref(row({ role })), /employment=intern/, role);
});

void test('the CSV has the new columns', () => {
  const csv = applicationsCsv([row({ channel: 'referral', referralStatus: 'asked', referral: 'Lee', stageLog: [['applied', new Date(2026, 0, 2).getTime()]] })], true);
  assert.match(csv, /"Channel","Referral status","Referrer","Link","Resume version","Next step","Follow up on","Stage history","Notes","Updated"\r\n/);
  assert.match(csv, /"Referral","Asked","Lee",""/);
  assert.match(csv, /"Applied 2026-01-02"/);
});

void test('the offer deadline is saved and read back at any stage, and cleared with null', async () => {
  const due = Date.UTC(2099, 0, 3, 17);
  const made = await call(ada, [], { company: 'Offerco', stage: 'offer', offerDeadline: due });
  assert.equal(made.status, 200);
  const { id } = made.data!.item;
  assert.equal(made.data!.item.offerDeadline, due);
  // A partial update without it keeps it; leaving the Offer stage keeps the date too.
  assert.equal((await call(ada, [id], { stage: 'rejected' })).data!.item.offerDeadline, due);
  assert.equal((await call(ada, [])).data!.items.find((a) => a.id === id)!.offerDeadline, due);
  assert.equal((await call(ada, [id], { offerDeadline: null })).data!.item.offerDeadline, null);
  assert.equal((await call(ada, [], { company: 'Plain' })).data!.item.offerDeadline, null);
  for (const offerDeadline of [-1, 1.5, '2099-01-03', 4102444800001])
    assert.equal((await call(ada, [], { company: 'Bad', offerDeadline })).status, 400, String(offerDeadline));
});

void test('offer deadlines ahead go in the calendar at the Offer stage only, reminded 3 days and a day before', () => {
  const now = Date.UTC(2098, 0, 1);
  const offer = row({ id: 'o', company: 'Acme', role: 'SWE', stage: 'offer', offerDeadline: Date.UTC(2099, 0, 2, 17) });
  const items = [
    offer,
    row({ id: 'p', stage: 'phone', offerDeadline: Date.UTC(2099, 0, 2) }),
    row({ id: 'q', stage: 'offer', offerDeadline: Date.UTC(2097, 0, 2) }),
  ];
  const ics = applicationsIcs(items, 'https://cswork.test', true, now);
  assert.equal(ics.match(/BEGIN:VEVENT/g)?.length, 1);
  assert.deepEqual(calendarItems(items, now), [offer]);
  assert.match(ics, /UID:cswork-application-o-offer@cswork\r\nDTSTAMP:\d+T\d+Z\r\nDTSTART:20990102T170000Z\r\nSUMMARY:Offer deadline: Acme · SWE\r\n/);
  assert.match(ics, /TRIGGER:-P3D\r\nEND:VALARM\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Offer deadline: Acme · SWE\r\nTRIGGER:-P1D\r\nEND:VALARM\r\nEND:VEVENT/);
  assert.match(applicationsIcs([offer], 'https://cswork.test', false, now), /SUMMARY:Offer 截止：Acme · SWE\r\n/);
});

void test('schedule clashes in the next two weeks: close interviews, piled-up OAs, an offer deadline on a busy day', () => {
  const at = (day: number, h: number, m = 0) => new Date(2099, 0, day, h, m).getTime();
  const now = at(1, 8);
  const issues = scheduleIssues(
    [
      row({ id: 'i1', stage: 'phone', interviewAt: at(3, 10) }),
      row({ id: 'i2', stage: 'onsite', interviewAt: at(3, 11, 29) }),
      // 90 minutes after i2: an hour plus the half-hour buffer fits.
      row({ id: 'i3', stage: 'onsite', interviewAt: at(3, 12, 59) }),
      row({ id: 'o1', stage: 'oa', oaDeadline: at(5, 9) }),
      row({ id: 'o2', stage: 'applied', oaDeadline: at(5, 18) }),
      row({ id: 'o3', stage: 'saved', oaDeadline: at(5, 23, 59) }),
      row({ id: 'o4', stage: 'oa', oaDeadline: at(6, 0, 1) }),
      row({ id: 'off', stage: 'offer', offerDeadline: at(8, 17), interviewAt: at(8, 9) }),
      row({ id: 'x', stage: 'oa', oaDeadline: at(8, 12) }),
      // Ignored: an ended card, anything past 14 days, an offer date kept at another stage.
      row({ id: 'gone', stage: 'rejected', interviewAt: at(3, 10, 30) }),
      row({ id: 'far1', stage: 'phone', interviewAt: at(16, 10) }),
      row({ id: 'far2', stage: 'phone', interviewAt: at(16, 10, 30) }),
      row({ id: 'kept', stage: 'phone', offerDeadline: at(6, 12) }),
    ],
    now,
  );
  assert.deepEqual(issues, [
    { kind: 'overlap', day: '2099-01-03', ids: ['i1', 'i2'] },
    { kind: 'oa-pile', day: '2099-01-05', ids: ['o1', 'o2', 'o3'] },
    { kind: 'offer-clash', day: '2099-01-08', ids: ['off', 'x'] },
  ]);
  assert.deepEqual(scheduleIssues([row({ id: 'gone', stage: 'withdrawn', oaDeadline: at(5, 9) })], now), []);
});

void test('the expedite plan: member write-ups first, then the board median, else unknown', () => {
  const now = 100 * DAY;
  assert.equal(expeditePlan([row({ stage: 'offer', offerDeadline: now - 1 }), row({ stage: 'phone' })], now), null, 'passed');
  assert.equal(expeditePlan([row({ stage: 'phone', offerDeadline: now + DAY })], now), null, 'the Offer stage only');
  const items = [
    row({ id: 'later', stage: 'offer', offerDeadline: now + 20 * DAY }),
    // Phone to offer took this board 30 days.
    row({ id: 'offer', stage: 'offer', offerDeadline: now + 10 * DAY, stageLog: [['phone', 0], ['offer', 30 * DAY]] }),
    row({ id: 'w', stage: 'oa', appliedAt: now - 7 * DAY, process: { weeks: 3 } }),
    row({ id: 'w2', stage: 'onsite', createdAt: now - 20 * DAY, process: { weeks: 2 } }),
    row({ id: 'm', stage: 'phone', stageLog: [['phone', now - 25 * DAY]] }),
    row({ id: 'u', stage: 'onsite', stageLog: [['onsite', now]] }),
    row({ id: 's', stage: 'applied' }),
  ];
  const plan = expeditePlan(items, now)!;
  assert.deepEqual([plan.offer.id, plan.deadline], ['offer', now + 10 * DAY]);
  assert.deepEqual(
    plan.rows.map((r) => [r.a.id, r.eta, r.late, r.overdue]),
    [
      ['w', now + 14 * DAY, true, false],
      // Its usual timeline ran out six days ago: not "in time", ask the recruiter.
      ['w2', now - 6 * DAY, true, true],
      ['m', now + 5 * DAY, false, false],
      ['u', null, false, false],
    ],
  );
});

void test('process weeks are looked up only while the learner has an offer deadline ahead', async () => {
  const cy = person('app-cy');
  const add = sqlite().prepare(
    `INSERT INTO experience_submissions(id,user_id,company_slug,title,role,interview_month,body,status,created_at,duration_weeks)
    VALUES(?,'someone','amazon','Loop','SDE','2026-09',?,'approved',1,?)`,
  );
  [2, 4, 6, 8, 10].forEach((weeks, i) => add.run(`xp-w${i}`, 'x'.repeat(100), weeks));
  const phone = (await call(cy, [], { company: 'Amazon', stage: 'phone' })).data!.item;
  assert.equal(phone.process, null);
  const offer = (await call(cy, [], { company: 'Rival', stage: 'offer', offerDeadline: Date.now() + 5 * DAY })).data!.item;
  assert.equal(offer.process, null, 'only cards still in process');
  const listed = () => call(cy, []).then((r) => r.data!.items.find((a) => a.id === phone.id)!);
  assert.deepEqual((await listed()).process, { weeks: 6 });
  assert.deepEqual((await call(cy, [phone.id], { notes: 'n' })).data!.item.process, { weeks: 6 }, 'one card saved sees the offer too');
  // A deadline kept after leaving the Offer stage, or one passed, looks nothing up.
  await call(cy, [offer.id], { stage: 'withdrawn' });
  assert.equal((await listed()).process, null);
  await call(cy, [offer.id], { stage: 'offer', offerDeadline: Date.now() - DAY });
  assert.equal((await listed()).process, null);
});

void test('the tier is saved, read back and changed, checked against the three tiers, and exported', async () => {
  const { item } = (await call(ada, [], { company: 'Dreamco', tier: 'dream' })).data!;
  assert.equal(item.tier, 'dream');
  assert.equal((await call(ada, [item.id], { tier: 'practice' })).data!.item.tier, 'practice');
  assert.equal((await call(ada, [item.id], { notes: 'kept' })).data!.item.tier, 'practice', 'an update without it keeps it');
  assert.equal((await call(ada, [], { company: 'Plain' })).data!.item.tier, '');
  for (const tier of ['reach', 'constructor', 'Dream'])
    assert.equal((await call(ada, [], { company: 'Bad', tier })).status, 400, tier);
  const csv = applicationsCsv([row({ stage: 'saved', tier: 'practice' })], true);
  assert.match(csv, /^\uFEFF"Company","Role","Stage","Tier","Applied"/);
  assert.match(csv, /"Acme","","Saved","Practice",""/);
  assert.match(applicationsCsv([row({ tier: 'dream' })], false), /"Acme","","已投递","梦想",""/);
});

void test('warm-up order: a dream interview as the first real one, practice companies left at Saved', () => {
  const now = Date.UTC(2026, 9, 1);
  const dream = row({ id: 'd', tier: 'dream', stage: 'phone', interviewAt: now + 5 * DAY });
  assert.deepEqual(warmupIssues([dream], now), [{ kind: 'dream-first', ids: ['d'] }]);
  // Another interview before it, ahead or already held: warmed up.
  assert.deepEqual(warmupIssues([dream, row({ id: 'p', tier: 'practice', stage: 'phone', interviewAt: now + 2 * DAY })], now), []);
  assert.deepEqual(warmupIssues([dream, row({ id: 'x', stage: 'rejected', interviewAt: now - 9 * DAY })], now), []);
  // Or logged at phone or onsite before it.
  assert.deepEqual(warmupIssues([dream, row({ id: 'y', stage: 'offer', stageLog: [['onsite', now - DAY], ['offer', now]] })], now), []);
  // Not warm-ups: an interview after it, one withdrawn before it happened, a phone stage logged after it.
  const later = row({ id: 'l', interviewAt: now + 6 * DAY });
  const dropped = row({ id: 'w', stage: 'withdrawn', interviewAt: now + DAY });
  const after = row({ id: 'z', stageLog: [['phone', now + 7 * DAY]] });
  assert.deepEqual(warmupIssues([dream, later, dropped, after], now).map((x) => x.kind), ['dream-first']);
  // Its own phone move does not count; no interview date, a past one, an ended card or another tier: nothing.
  assert.equal(warmupIssues([{ ...dream, stageLog: [['phone', now - DAY]] }], now).length, 1);
  for (const d of [{ interviewAt: null }, { interviewAt: now - DAY }, { stage: 'rejected' as const }, { tier: 'target' }])
    assert.deepEqual(warmupIssues([{ ...dream, ...d }], now), [], JSON.stringify(d));

  const saved = row({ id: 's1', tier: 'practice', stage: 'saved' });
  const applied = row({ id: 'd2', tier: 'dream', stage: 'applied' });
  assert.deepEqual(warmupIssues([applied, saved, row({ id: 's2', tier: 'practice', stage: 'saved' })], now), [
    { kind: 'practice-waiting', ids: ['d2', 's1', 's2'] },
  ]);
  assert.deepEqual(warmupIssues([{ ...applied, stage: 'oa' }, saved], now)[0].kind, 'practice-waiting');
  assert.deepEqual(warmupIssues([{ ...applied, stage: 'saved' }, saved], now), [], 'the dream one not sent yet');
  assert.deepEqual(warmupIssues([applied, { ...saved, stage: 'applied' }, { ...saved, id: 's3', tier: 'target' }], now), []);
});

void test("deleting a card removes its interview retros, nobody else's notes", async () => {
  const { item } = (await call(ada, [], { company: 'Retroco', stage: 'phone' })).data!;
  const { item: keep } = (await call(ada, [], { company: 'Keepco' })).data!;
  const insert = sqlite().prepare('INSERT INTO user_notes(user_id,target,body,updated_at) VALUES(?,?,?,1)');
  insert.run(ada.id, `retro:${item.id}/a1`, '{}');
  insert.run(ada.id, `retro:${item.id}/a2`, '{}');
  insert.run(ada.id, `retro:${keep.id}/a1`, '{}');
  insert.run(ben.id, `retro:${item.id}/a1`, '{}');
  assert.equal((await call(ada, [item.id, 'delete'], {})).status, 200);
  const left = sqlite().prepare("SELECT user_id||' '||target AS k FROM user_notes WHERE target LIKE 'retro:%' ORDER BY k").pluck().all();
  assert.deepEqual(left, [`${ada.id} retro:${keep.id}/a1`, `${ben.id} retro:${item.id}/a1`]);
});
