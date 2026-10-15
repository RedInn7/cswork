// The resume builder's data side: GET profile/resume-facts reads only the caller's own record
// (certificates, rating, solved counts, a public handle), and the client helpers turn a stored or
// imported file into a resume, the resume into plain text, and merge the facts in once.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-resume-builder-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
delete process.env.CONTENT_DATABASE_PATH;
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { publicCatalogue, publicProfile } = await import('../lib/server/learner-cloud');
const { blankResume, mergeFacts, normalizeResume, resumeText } = await import('../components/resume-builder');

const person = (id: string): Person => ({ id, name: id, email: `${id}@example.test`, role: 'student', verified: true });
const at = Date.UTC(2026, 2, 3, 12);

async function facts(p: Person, method = 'GET') {
  const response = await handleOj(new Request('https://cswork.test/api/oj/profile/resume-facts', { method }), p, ['profile', 'resume-facts']);
  return (await response.json()) as {
    certificates: { id: string; course: string; issuedAt: number; skill: boolean }[];
    rating: number | null;
    contests: number;
    solved: { total: number; easy: number; medium: number; hard: number };
    handle: string | null;
  };
}

before(() => {
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
  const db = sqlite();
  for (const id of ['u-me', 'u-other'])
    db.prepare('INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,1,1,1)').run(id, id, `${id}@example.test`);
  db.prepare(
    `INSERT INTO user_profiles(user_id,handle,visible,indexable,show_contest,bio,created_at,updated_at) VALUES
    ('u-me','me-public',1,0,0,'',1,1),('u-other','other-one',0,0,0,'',1,1)`,
  ).run();
  let n = 0;
  for (const [user, problem] of [
    ['u-me', 'lc-1'],
    ['u-me', 'lc-1'],
    ['u-me', 'lc-3'],
    ['u-me', 'course-x'],
    ['u-other', 'lc-2'],
  ])
    db.prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,mode,created_at,updated_at)
      VALUES(?,?,?,'python','','accepted',1,1,'judge',?,?)`,
    ).run(`s${++n}`, user, problem, at, at);
  db.prepare(
    `INSERT INTO contest_rooms(id,owner_id,title,kind,problem_ids_json,starts_at,duration_min,visibility,rated_at,created_at)
    VALUES('weekly-7',NULL,'w','weekly','[]',?,90,'public',1,1),('weekly-8',NULL,'w','weekly','[]',?,90,'public',1,1)`,
  ).run(at, at + 7 * 86400000);
  db.prepare(
    `INSERT INTO contest_ratings(user_id,room_id,before,after,rank,entrants,solved,created_at) VALUES
    ('u-me','weekly-7',1500,1540,1,9,1,1),('u-me','weekly-8',1540,1588,1,9,1,2),('u-other','weekly-7',1500,1400,2,9,0,1)`,
  ).run();
  // Not listed on the profile: still the holder's own, so the resume may cite it.
  db.prepare(
    `INSERT INTO certificates(id,user_id,course_id,issued_at,on_profile) VALUES('MyCert0000000001','u-me','sd:system-design',?,0),
    ('MySkill000000001','u-me','skill:sql',?,1),('OtherCert0000001','u-other','sd:system-design',?,1)`,
  ).run(at, at + 1, at);
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('resume facts are the caller’s own, in English, with the profile’s solved counts', async () => {
  const mine = await facts(person('u-me'));
  assert.deepEqual(
    mine.certificates.map((c) => [c.id, c.skill]),
    [
      ['MySkill000000001', true],
      ['MyCert0000000001', false],
    ],
  );
  assert.equal(mine.certificates[1].course, 'System Design Interview Course');
  assert.equal(mine.rating, 1588);
  assert.equal(mine.contests, 2);
  assert.equal(mine.handle, 'me-public');
  assert.deepEqual(mine.solved, publicProfile('me-public', await publicCatalogue())!.solved);
  assert.ok(mine.solved.total <= 2, 'a course exercise never counts');
  const other = await facts(person('u-other'));
  assert.equal(other.handle, null, 'a hidden profile has no link to cite');
  assert.deepEqual(other.certificates.map((c) => c.id), ['OtherCert0000001']);
  const stranger = await facts(person('u-new'));
  assert.deepEqual([stranger.certificates, stranger.rating, stranger.contests, stranger.handle], [[], null, 0, null]);
  await assert.rejects(facts(person('u-me'), 'POST'), { status: 404 });
  await assert.rejects(handleOj(new Request('https://cswork.test/api/oj/profile/resume-facts'), null, ['profile', 'resume-facts']), {
    status: 401,
  });
});

void test('a stored or imported file becomes a resume with only known, capped fields', () => {
  const r = normalizeResume({
    name: 'Ada'.repeat(100),
    email: 42,
    education: [{ title: 'MIT', bullets: 'GPA 4.0', evil: '<script>' }, 'junk'],
    projects: Array.from({ length: 30 }, () => ({})),
    extra: true,
  });
  assert.equal(r.name.length, 80);
  assert.equal(r.email, '');
  assert.deepEqual(r.education, [
    { title: 'MIT', subtitle: '', dates: '', bullets: 'GPA 4.0' },
    { title: '', subtitle: '', dates: '', bullets: '' },
  ]);
  assert.equal(r.projects.length, 20);
  assert.deepEqual(r.experience, []);
  assert.equal('extra' in r, false);
  assert.deepEqual(normalizeResume(null), { ...blankResume(), education: [], experience: [], projects: [] });
});

void test('plain text keeps the standard headings and one bullet per line', () => {
  const r = {
    ...blankResume(),
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    links: 'github.com/ada',
    experience: [{ title: 'Analytical Engines', subtitle: 'Engineer', dates: '1843', bullets: '- Wrote the first program\n\n• Cut runtime 40%' }],
    skills: 'Languages: Python',
    awards: 'Best paper',
  };
  assert.equal(
    resumeText(r),
    [
      'Ada Lovelace',
      'ada@example.com | github.com/ada',
      '',
      'EXPERIENCE',
      'Analytical Engines | Engineer | 1843',
      '- Wrote the first program',
      '- Cut runtime 40%',
      '',
      'SKILLS',
      'Languages: Python',
      '',
      'AWARDS & CERTIFICATIONS',
      '- Best paper',
    ].join('\n'),
  );
  assert.equal(resumeText(blankResume()), '');
});

void test('CSWork facts merge in once: certificates and rating to awards, counts to skills, the profile to links', () => {
  const f = {
    certificates: [{ id: 'MyCert0000000001', course: 'System Design Interview Course', issuedAt: at, skill: false }],
    rating: 1588,
    contests: 2,
    solved: { total: 12, easy: 5, medium: 6, hard: 1 },
    handle: 'me-public',
  };
  const once = mergeFacts({ ...blankResume(), awards: 'Dean’s list', links: 'github.com/ada' }, f);
  assert.equal(once.added, 4);
  assert.deepEqual(once.resume.awards.split('\n'), [
    'Dean’s list',
    'System Design Interview Course, CSWork certificate, Mar 2026 (cswork.org/certificate/MyCert0000000001)',
    'CSWork contest rating 1588 (2 rated contests)',
  ]);
  assert.equal(once.resume.skills, 'Algorithms: 12 problems solved on CSWork (5 easy, 6 medium, 1 hard)');
  assert.equal(once.resume.links, 'github.com/ada, cswork.org/u/me-public');
  const twice = mergeFacts(once.resume, f);
  assert.equal(twice.added, 0);
  assert.deepEqual(twice.resume, once.resume);
  const none = mergeFacts(blankResume(), { ...f, certificates: [], rating: null, solved: { total: 0, easy: 0, medium: 0, hard: 0 }, handle: null });
  assert.equal(none.added, 0);
  // Another contest and more ACs later: the numbers are replaced, never stacked (a bullet the learner added included).
  const bulleted = { ...once.resume, awards: once.resume.awards.replace('CSWork contest', '- CSWork contest') };
  const later = mergeFacts(bulleted, { ...f, rating: 1630, contests: 3, solved: { total: 15, easy: 6, medium: 7, hard: 2 } });
  assert.equal(later.added, 2);
  assert.deepEqual(later.resume.awards.split('\n'), [
    'Dean’s list',
    'System Design Interview Course, CSWork certificate, Mar 2026 (cswork.org/certificate/MyCert0000000001)',
    'CSWork contest rating 1630 (3 rated contests)',
  ]);
  assert.equal(later.resume.skills, 'Algorithms: 15 problems solved on CSWork (6 easy, 7 medium, 2 hard)');
  // No rating this time: the old line stays as the learner left it.
  assert.equal(mergeFacts(later.resume, { ...f, rating: null }).resume.awards, later.resume.awards);
});
