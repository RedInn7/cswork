import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import course from '../lib/content/system-design-course.json';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-sd-course-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { sdCases, sdChapter, sdChapters, sdParts, sdPath, sdSummary, systemDesignPaths } = await import(
  '../lib/server/system-design-course'
);
const { DIAGRAM_MAX_LENGTH } = await import('../lib/course-diagram');

const CHAPTER = ['bodyEn', 'bodyZh', 'quiz', 'slug', 'titleEn', 'titleZh'];
const QUESTION = ['answer', 'choices', 'qEn', 'qZh', 'whyEn', 'whyZh'];
const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

void test('the course file has unique slugs and complete bilingual chapters and quizzes', () => {
  assert.deepEqual(Object.keys(course), ['chapters']);
  const chapters = course.chapters as Record<string, unknown>[];
  assert.ok(chapters.length >= 2, 'the seed keeps at least two chapters');
  const bad: string[] = [];
  const slugs = new Set<string>();
  for (const [c, chapter] of chapters.entries()) {
    const at = `chapters[${c}]`;
    assert.deepEqual(Object.keys(chapter).sort(), CHAPTER, at);
    const slug = String(chapter.slug);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 60) bad.push(`${at}.slug: ${slug}`);
    if (slugs.has(slug)) bad.push(`${at}.slug: duplicate ${slug}`);
    slugs.add(slug);
    for (const key of ['titleZh', 'titleEn', 'bodyZh', 'bodyEn'])
      if (!text(chapter[key])) bad.push(`${at}.${key}: empty`);
    if (String(chapter.titleZh).length > 40 || String(chapter.titleEn).length > 80)
      bad.push(`${at}: title too long`);
    // The chapter page owns the h1; a body heading starts at ##.
    for (const key of ['bodyZh', 'bodyEn'])
      if (/^# /m.test(String(chapter[key]))) bad.push(`${at}.${key}: has an h1`);
    if (!/[一-鿿]/.test(String(chapter.bodyZh))) bad.push(`${at}.bodyZh: no Chinese`);
    if (!Array.isArray(chapter.quiz)) {
      bad.push(`${at}.quiz: not a list`);
      continue;
    }
    for (const [q, question] of (chapter.quiz as Record<string, unknown>[]).entries()) {
      const where = `${at}.quiz[${q}]`;
      assert.deepEqual(Object.keys(question).sort(), QUESTION, where);
      for (const key of ['qZh', 'qEn', 'whyZh', 'whyEn'])
        if (!text(question[key])) bad.push(`${where}.${key}: empty`);
      const choices = question.choices as { zh?: unknown; en?: unknown }[];
      if (!Array.isArray(choices) || choices.length < 2 || choices.length > 6) {
        bad.push(`${where}.choices: needs 2-6`);
        continue;
      }
      choices.forEach((choice, i) => {
        assert.deepEqual(Object.keys(choice).sort(), ['en', 'zh'], `${where}.choices[${i}]`);
        if (!text(choice.zh) || !text(choice.en)) bad.push(`${where}.choices[${i}]: empty`);
      });
      const answer = question.answer;
      if (!Number.isInteger(answer) || (answer as number) < 0 || (answer as number) >= choices.length)
        bad.push(`${where}.answer: out of range`);
    }
  }
  assert.deepEqual(bad, []);
});

void test('the loader finds chapters by slug and lists the course pages for the sitemap', () => {
  // The mock interview's design rounds link to /system-design/framework.
  assert.equal(sdChapter('framework')?.slug, 'framework');
  assert.equal(sdChapter('nope'), undefined);
  assert.equal(sdChapter('__proto__'), undefined);
  assert.equal(sdPath(), '/system-design');
  assert.deepEqual(
    systemDesignPaths().map((entry) => entry.path),
    ['/system-design', ...sdChapters.map((chapter) => `/system-design/${chapter.slug}`)],
  );
});

void test('the index parts cover every chapter once, in order, ending with ML system design', () => {
  assert.equal(sdParts[0].chapters[0], sdChapters[0]);
  assert.deepEqual(
    sdParts.flatMap((part) => part.chapters),
    sdChapters,
  );
  assert.ok(sdParts.every((part) => part.chapters[0]?.slug === part.from));
  assert.deepEqual(
    sdParts.at(-1)?.chapters.map((chapter) => chapter.slug),
    ['ml-design-framework', 'recsys-ranking', 'search-ranking', 'ads-ctr', 'fraud-detection'],
  );
});

void test('every case chapter grades answers and sets level expectations in both languages', () => {
  assert.equal(sdCases.size, 16);
  const missing: string[] = [];
  for (const slug of sdCases) {
    const chapter = sdChapter(slug);
    if (!chapter) {
      missing.push(`${slug}: no such chapter`);
      continue;
    }
    for (const [key, grades, levels] of [
      ['bodyZh', /^## \d+\. 回答分级$/m, /^## \d+\. 不同级别的期望$/m],
      ['bodyEn', /^## \d+\. Bad \/ Good \/ Great$/m, /^## \d+\. Level Expectations$/m],
    ] as const) {
      const body = chapter[key];
      if (!grades.test(body) || !levels.test(body)) missing.push(`${slug}.${key}: sections`);
      for (const grade of ['**Bad**', '**Good**', '**Great**'])
        if (!body.includes(grade)) missing.push(`${slug}.${key}: ${grade}`);
      for (const level of ['Mid', 'Senior', 'Staff'])
        if (!new RegExp(`^\\| ${level}[ （(]`, 'm').test(body)) missing.push(`${slug}.${key}: ${level}`);
    }
  }
  assert.deepEqual(missing, []);
});

void test('diagrams are mermaid within the renderer limit, and quizzes give nothing away', () => {
  for (const chapter of sdChapters)
    for (const body of [chapter.bodyZh, chapter.bodyEn])
      for (const [, source] of body.matchAll(/^```mermaid\n([\s\S]*?)^```/gm))
        assert.ok(source.length <= DIAGRAM_MAX_LENGTH, chapter.slug);
  // The answer sits in every position about as often, and is not a tell by being the longest.
  const questions = sdChapters.flatMap((chapter) => chapter.quiz);
  const at = [0, 0, 0, 0];
  let longest = 0;
  for (const question of questions) {
    at[question.answer]++;
    for (const lang of ['zh', 'en'] as const) {
      const lengths = question.choices.map((choice) => choice[lang].length);
      const top = Math.max(...lengths);
      if (lengths[question.answer] === top && lengths.filter((n) => n === top).length === 1) longest++;
    }
  }
  assert.ok(Math.max(...at) <= questions.length * 0.4, `answer positions ${at}`);
  assert.ok(longest <= questions.length * 2 * 0.3, `the answer is the longest choice ${longest} times`);
  for (const chapter of sdChapters)
    if (chapter.quiz.length >= 5)
      assert.ok(new Set(chapter.quiz.map((q) => q.answer)).size >= 3, `${chapter.slug}: answers spread out`);
});

void test('a summary is the first paragraph as plain text, cut with an ellipsis', () => {
  assert.equal(
    sdSummary('## Heading\n\nSee the [framework](/system-design/framework) and `code`.\n\nMore.'),
    'See the framework and code.',
  );
  assert.equal(sdSummary('- a list\n\n> quote\n\nPlain text.'), 'Plain text.');
  const cut = sdSummary('x'.repeat(300), 20);
  assert.equal(cut.length, 20);
  assert.ok(cut.endsWith('…'));
});

const me: Person = { id: 'sd-me', name: 'Me', email: 'me@example.test', role: 'student', verified: true };
function call(p: Person | null, method: string, path: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/oj/${path}`);
  return handleOj(
    new Request(url, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    }),
    p,
    url.pathname.split('/').slice(3),
  );
}

before(() => migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') }));
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('a chapter is marked read as sd:<slug>, and its design draft is the note sd:<slug>/draft', async () => {
  const mark = { target: 'sd:url-shortener', mark: 'read', on: true };
  assert.equal((await call(me, 'POST', 'marks', mark)).status, 200);
  const read = (await (await call(me, 'GET', 'marks?mark=read')).json()) as { items: { target: string }[] };
  assert.deepEqual(read.items.map((item) => item.target), ['sd:url-shortener']);
  await call(me, 'POST', 'marks', { ...mark, on: false });
  assert.deepEqual(((await (await call(me, 'GET', 'marks?mark=read')).json()) as { items: unknown[] }).items, []);
  const draft = 'notes?target=sd:url-shortener/draft';
  assert.equal((await call(me, 'PUT', draft, { body: 'Requirements: shorten, redirect' })).status, 200);
  assert.equal(
    ((await (await call(me, 'GET', draft)).json()) as { body: string }).body,
    'Requirements: shorten, redirect',
  );
  await call(me, 'PUT', draft, { body: '' });
});

void test('quiz answers are a private note on sd:<slug>, removed when emptied', async () => {
  const path = 'notes?target=sd:url-shortener';
  const body = JSON.stringify({ picks: [1, null, 0] });
  assert.equal((await call(me, 'PUT', path, { body })).status, 200);
  assert.equal(((await (await call(me, 'GET', path)).json()) as { body: string }).body, body);
  await assert.rejects(Promise.resolve().then(() => call(null, 'GET', path)), { status: 401 });
  await assert.rejects(Promise.resolve().then(() => call(me, 'PUT', 'notes?target=sd:a%20b', { body })));
  assert.equal((await call(me, 'PUT', path, { body: '' })).status, 200);
  assert.equal(
    (sqlite().prepare("SELECT COUNT(*) AS n FROM user_notes WHERE target LIKE 'sd:%'").get() as { n: number }).n,
    0,
  );
});
