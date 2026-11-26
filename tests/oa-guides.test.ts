// OA guides and extra reference programs (content/oa-judge/guides, solutions): the hint ladder
// on GET problems/<id> replaces the package's own hints for everyone, signed out too, and goes
// away inside the learner's running exam; the editorial gains English and the verified languages.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire, register } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';
import type { OjProblemPackage } from '../lib/oj-types';
import { passingPrograms, programKey } from '../lib/oa-solution-evidence.mjs';

// The public OA page renders here: stylesheets load as nothing, next/link is a plain link, and
// next/headers says which language URL (/ja/oa/...) is being served.
const urlLanguage: { current?: string } = {};
Object.assign(globalThis, { urlLanguage });
const react = JSON.stringify(pathToFileURL(createRequire(import.meta.url).resolve('react')).href);
register(
  `data:text/javascript,${encodeURIComponent(`const mocks={
  'next/headers':'export const cookies=async()=>({get:()=>undefined});export const headers=async()=>new Headers(globalThis.urlLanguage.current?{"x-cswork-language":globalThis.urlLanguage.current}:{});',
  'next/navigation':'export function notFound(){throw new Error("NEXT_NOT_FOUND");}',
  'next/link':'import {createElement} from ${react.replaceAll("'", "\\'")};export default function Link({href,prefetch,...rest}){return createElement("a",{href,...rest});}'};
export async function resolve(s,c,n){if(mocks[s])return {url:'mock:'+s,shortCircuit:true};return n(s,c);}
export async function load(u,c,n){
  if(u.startsWith('mock:'))return {format:'module',source:mocks[u.slice(5)],shortCircuit:true};
  if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};
  return n(u,c);}`)}`,
  import.meta.url,
);
const dir = mkdtempSync(join(tmpdir(), 'cswork-oa-guides-'));
process.env.DATABASE_PATH = join(dir, 'app.sqlite');
const { sqlite } = await import('../db/sqlite');
const { saveProblemDraft, publishProblemDraft } = await import('../lib/server/oj-problems');
const { handleOj } = await import('../lib/server/oj-api');

const teacher: Person = { id: 'guide-teacher', name: 'T', email: 't@guides.test', role: 'teacher', verified: true };
const student: Person = { id: 'guide-student', name: 'S', email: 's@guides.test', role: 'student', verified: true };
const GUIDED = 'oa-meta-10';
const PLAIN = 'oa-capital-one-2';
// Translated into Japanese: statement, hints and written editorial.
const JA = 'oa-google-25';
const guide = JSON.parse(readFileSync(`content/oa-judge/guides/${GUIDED}.json`, 'utf8'));
// Only GUIDED's sidecars, so PLAIN stays a problem without a guide however much content ships.
const sidecars = join(dir, 'sidecars');
for (const sub of ['guides', 'solutions', 'reports']) mkdirSync(join(sidecars, sub), { recursive: true });
copyFileSync(`content/oa-judge/guides/${GUIDED}.json`, join(sidecars, 'guides', `${GUIDED}.json`));
copyFileSync(`content/oa-judge/guides/${JA}.json`, join(sidecars, 'guides', `${JA}.json`));
copyFileSync(`content/oa-judge/solutions/${GUIDED}.json`, join(sidecars, 'solutions', `${GUIDED}.json`));
copyFileSync('content/oa-judge/reports/solutions-pilot.json', join(sidecars, 'reports', 'solutions-pilot.json'));
(await import('../lib/server/oa-judge')).useOaSidecarRoot(sidecars);

before(async () => {
  const db = sqlite();
  migrate(drizzle(db), { migrationsFolder: resolve('drizzle') });
  db.prepare("INSERT INTO courses(id,title,summary,version,published) VALUES('gomall','GoMall','x','1',1)").run();
  db.prepare(
    "INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES('00-overview','gomall','x','x','x',0,'x','1',0)",
  ).run();
  for (const id of [GUIDED, PLAIN, JA]) {
    const pkg = JSON.parse(readFileSync(`content/oa-judge/packages/${id}.json`, 'utf8')) as OjProblemPackage;
    const draft = await saveProblemDraft(teacher, pkg, null);
    await publishProblemDraft(teacher, id, draft.draft!.revision);
  }
});
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

const get = async (path: string[], p: Person | null, language?: string) => {
  const response = await handleOj(
    new Request(`https://cswork.test/api/oj/${path.join('/')}`, { headers: language ? { 'X-Language': language } : {} }),
    p,
    path,
  );
  return response.json();
};

void test('a guided OA problem serves its ladder to everyone and drops the package hints, English ones included', async () => {
  const problem = await get(['problems', GUIDED], null);
  assert.deepEqual(problem.oaHints, guide.hints);
  assert.deepEqual(problem.hints, []);
  assert.deepEqual(problem.translations.en.hints, []);
  assert.ok(problem.translations.en.description, 'the English statement stays');
  assert.equal(problem.lingHints, null);
  // Without a guide the package's hints stay where they were.
  const plain = await get(['problems', PLAIN], null);
  assert.equal(plain.oaHints, null);
  assert.ok(plain.hints.length > 0 && plain.translations.en.hints.length > 0);
});

void test('failed formal submissions reach the ladder after a reload', async () => {
  const add = sqlite().prepare(
    `INSERT INTO submissions(id,user_id,problem_id,language,code,status,total,created_at,updated_at,mode) VALUES(?,?,?,'python','',?,1,?,?,?)`,
  );
  add.run('guide-wa', student.id, GUIDED, 'wrong_answer', 1, 1, 'judge');
  add.run('guide-run', student.id, GUIDED, 'wrong_answer', 2, 2, 'run');
  add.run('plain-wa', student.id, PLAIN, 'wrong_answer', 3, 3, 'judge');
  assert.deepEqual((await get(['problems', GUIDED], student)).failedSubmissionIds, ['guide-wa']);
  // No ladder, nothing to unlock.
  assert.deepEqual((await get(['problems', PLAIN], student)).failedSubmissionIds, []);
});

void test('the editorial adds the written write-up and the verified languages; a running exam withholds both', async () => {
  // The written editorial (content/oa-master/editorials) replaces the text; the code stays the registry's.
  const written = (id: string) =>
    JSON.parse(readFileSync(`content/oa-master/editorials/${id}.json`, 'utf8')) as { explanation: string; explanationEn: string };
  const solution = await get(['oa-library', GUIDED, 'solution'], student);
  assert.equal(solution.explanation, written(GUIDED).explanation);
  assert.equal(solution.explanationEn, written(GUIDED).explanationEn);
  assert.match(solution.explanation, /思路/);
  assert.deepEqual(
    solution.solutions.map((item: { language: string }) => item.language),
    ['python', 'cpp', 'java', 'go'],
  );
  const plain = await get(['oa-library', PLAIN, 'solution'], student);
  assert.equal(plain.explanationEn, written(PLAIN).explanationEn);
  assert.equal(plain.solutions.length, 1);
  // A certification exam holding the problem counts as a running contest.
  const now = Date.now();
  sqlite()
    .prepare(
      "INSERT INTO skill_attempts(id,user_id,test,ids_json,started_at,deadline,created_at) VALUES('guide-exam',?,'oa',?,?,?,?)",
    )
    .run(student.id, JSON.stringify([GUIDED]), now - 1000, now + 3_600_000, now - 1000);
  const live = await get(['problems', GUIDED], student);
  assert.equal(live.oaHints, null);
  assert.deepEqual([live.hints, live.translations.en.hints], [[], []]);
  await assert.rejects(get(['oa-library', GUIDED, 'solution'], student), { status: 403 });
  // Another learner, or a visitor, is not in that exam.
  assert.deepEqual((await get(['problems', GUIDED], null)).oaHints, guide.hints);
});

void test('only programs whose latest report passed every case of that package count as verified', () => {
  const root = mkdtempSync(join(tmpdir(), 'cswork-oa-evidence-'));
  try {
    mkdirSync(join(root, 'reports'));
    const base = { id: 'oa-x-1', sha256: 'a'.repeat(64), packageChecksum: 'b'.repeat(64) };
    writeFileSync(
      join(root, 'reports', 'solutions-one.json'),
      JSON.stringify({
        results: [
          { ...base, language: 'java', passed: 3, total: 3 },
          { ...base, language: 'go', passed: 2, total: 3 },
          { ...base, language: 'cpp', passed: 0, total: 0 },
        ],
      }),
    );
    // Not a solutions report: never read.
    writeFileSync(join(root, 'reports', 'batch-one.json'), JSON.stringify({ results: [{ ...base, language: 'python', passed: 1, total: 1 }] }));
    const keys = passingPrograms(root);
    assert.deepEqual([...keys], [programKey({ ...base, language: 'java' })]);
    assert.equal(keys.has(programKey({ ...base, language: 'java', packageChecksum: 'c'.repeat(64) })), false);
    // A later run in another chunk decides: java now fails there, go now passes.
    const at = (day: number) => `2026-10-${day}T00:00:00.000Z`;
    writeFileSync(
      join(root, 'reports', 'solutions-one.json'),
      JSON.stringify({
        results: [
          { ...base, language: 'java', passed: 3, total: 3, verifiedAt: at(10) },
          { ...base, language: 'go', passed: 2, total: 3, verifiedAt: at(10) },
          { ...base, language: 'cpp', passed: 3, total: 3, verifiedAt: at(12) },
        ],
      }),
    );
    writeFileSync(
      join(root, 'reports', 'solutions-two.json'),
      JSON.stringify({
        results: [
          { ...base, language: 'java', passed: 2, total: 3, verifiedAt: at(11) },
          { ...base, language: 'go', passed: 3, total: 3, verifiedAt: at(11) },
          { ...base, language: 'cpp', passed: 0, total: 3, verifiedAt: at(11) },
        ],
      }),
    );
    assert.deepEqual(
      [...passingPrograms(root)].sort(),
      [programKey({ ...base, language: 'go' }), programKey({ ...base, language: 'cpp' })].sort(),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

void test('a guide binds to the live package and the catalog source it was written from', async () => {
  const { createOaJudgeRegistry } = await import('../lib/server/oa-judge');
  const [source, pkg, other] = ['a', 'b', 'c'].map((c) => c.repeat(64));
  const registry = createOaJudgeRegistry(
    {
      schemaVersion: 1,
      items: [{ id: 'oa-x-1', sourceContentHash: source, packageChecksum: pkg, editorial: 'x', authoredSolutions: [{ language: 'python', code: 'x' }] }],
    },
    new Map([['oa-x-1', source]]),
  );
  assert.equal(registry.isCurrent('oa-x-1', pkg), true);
  assert.equal(registry.isCurrent('oa-x-1', pkg, source), true);
  assert.equal(registry.isCurrent('oa-x-1', pkg, other), false);
  assert.equal(registry.isCurrent('oa-x-1', other, source), false);
  // The English editorial is checked against the registry's own.
  assert.equal(registry.editorialSha256('oa-x-1'), createHash('sha256').update('x').digest('hex'));
  assert.equal(registry.editorialSha256('oa-x-2'), undefined);
});

void test('check-guides fails a guide whose English editorial translates an older registry editorial', () => {
  const root = mkdtempSync(join(tmpdir(), 'cswork-oa-check-guides-'));
  try {
    const judge = join(root, 'content/oa-judge');
    mkdirSync(join(judge, 'guides'), { recursive: true });
    const entry = { id: GUIDED, sourceContentHash: guide.sourceContentHash, packageChecksum: guide.packageChecksum, editorial: '新的题解', authoredSolutions: [{ language: 'python', code: 'x' }] };
    writeFileSync(join(judge, 'registry.json'), JSON.stringify({ schemaVersion: 1, items: [entry] }));
    writeFileSync(join(judge, 'guides', `${GUIDED}.json`), JSON.stringify(guide));
    const run = () => spawnSync(process.execPath, [resolve('scripts/oa-judge/check-guides.mjs')], { cwd: root, encoding: 'utf8' });
    const stale = run();
    assert.equal(stale.status, 1);
    assert.match(stale.stdout, /stale editorialSha256/);
    writeFileSync(
      join(judge, 'guides', `${GUIDED}.json`),
      JSON.stringify({ ...guide, editorialSha256: createHash('sha256').update(entry.editorial).digest('hex') }),
    );
    assert.equal(run().status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

void test('a Japanese reader is served the Japanese statement, hints and editorial; other readers are not sent them', async () => {
  const read = (dir: string) => JSON.parse(readFileSync(`content/${dir}/${JA}.json`, 'utf8'));
  const problem = await get(['problems', JA], null, 'ja');
  assert.deepEqual(Object.keys(problem.translations), ['en', 'ja']);
  assert.equal(problem.translations.ja.title, read('oa-judge/translations').ja.title);
  // The guide's ladder replaces the package hints in every language.
  assert.deepEqual(problem.translations.ja.hints, []);
  assert.deepEqual(problem.oaHints, read('oa-judge/guides').hints);
  assert.deepEqual((await get(['oa-library', JA, 'solution'], student, 'ja')).explanationLocal, { ja: read('oa-master/editorials').explanationJa });
  for (const language of [undefined, 'en', 'ko', 'zh-Hant']) {
    const other = await get(['problems', JA], null, language);
    assert.deepEqual([Object.keys(other.translations), Object.keys(other.oaHints)], [['en'], ['zh', 'en']], String(language));
    assert.equal('explanationLocal' in (await get(['oa-library', JA, 'solution'], student, language)), false);
  }
  // A problem with no Japanese text reads as before.
  const guided = await get(['problems', GUIDED], null, 'ja');
  assert.deepEqual([Object.keys(guided.translations), guided.oaHints], [['en'], guide.hints]);
});

void test('the public OA page is Japanese on /ja when translated, its own canonical page and in the ja sitemap; otherwise English', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: Page, generateMetadata } = await import('../app/oa/[company]/[id]/page');
  const { oaLibrary } = await import('../lib/server/oa-library');
  const { oaReadyProblems, oaTranslations } = await import('../lib/server/oa-judge');
  const ja = JSON.parse(readFileSync(`content/oa-judge/translations/${JA}.json`, 'utf8')).ja;
  const open = async (language: string, company: string, id: string) => {
    urlLanguage.current = language;
    const params = Promise.resolve({ company, id });
    return { html: renderToStaticMarkup(await Page({ params })), meta: await generateMetadata({ params }) };
  };
  try {
    const page = await open('ja', 'google', JA);
    assert.match(page.html, new RegExp(`<h1 lang="ja">${ja.title}</h1>`));
    assert.match(page.html, /<div class="public-library-prose" lang="ja">/);
    assert.match(page.html, /<h2[^>]*>入力<\/h2>[\s\S]*<h2[^>]*>例 1<\/h2>/);
    assert.ok(page.html.includes(ja.output));
    assert.equal(page.meta.title, `Google OA: ${ja.title} | CSWork`);
    assert.match(page.meta.description ?? '', /空でない整数配列/);
    assert.equal(page.meta.alternates?.canonical, `https://cswork.org/ja/oa/google/${JA}`);
    assert.deepEqual(Object.keys(page.meta.alternates?.languages ?? {}), ['zh-Hans', 'zh-Hant', 'en', 'ja', 'x-default']);
    // Korean is not translated: the English page, which is also the canonical one.
    const korean = await open('ko', 'google', JA);
    assert.match(korean.html, /<div class="public-library-prose" lang="en">/);
    assert.match(korean.html, /<h2[^>]*>Input<\/h2>/);
    assert.doesNotMatch(korean.html, /lang="ja"|入力/);
    assert.equal(korean.meta.alternates?.canonical, `https://cswork.org/en/oa/google/${JA}`);
    // A problem with no Japanese text, on its /ja URL: exactly the English page.
    const plain = await open('ja', 'capital-one', PLAIN);
    assert.match(plain.html, /<div class="public-library-prose" lang="en">/);
    assert.doesNotMatch(plain.html, /lang="ja"/);
    assert.equal(plain.meta.alternates?.canonical, `https://cswork.org/en/oa/capital-one/${PLAIN}`);
    assert.deepEqual(Object.keys(plain.meta.alternates?.languages ?? {}), ['zh-Hans', 'zh-Hant', 'en', 'x-default']);
  } finally {
    urlLanguage.current = undefined;
  }
  // /ja/sitemap/1 adds the translated problems only (app/sitemap/[page]/route.ts).
  const ready = await oaReadyProblems();
  const paths = (language: 'ja' | 'ko') =>
    oaLibrary()
      .sitemapEntries(ready, (id) => !!oaTranslations(id)?.[language])
      .map((entry) => entry.path);
  assert.deepEqual(paths('ja'), [`/oa/google/${JA}`]);
  assert.deepEqual(paths('ko'), []);
});
