// The beginner crash courses (lib/content/beginner-courses.json): complete bilingual chapters,
// quizzes that give nothing away, Line 500 practice that the judge has, sitemap paths, and the
// course certificate issued when the last chapter is marked read.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import file from '../lib/content/beginner-courses.json';
import contracts from '../lib/content/leetcode-contracts.json';
import { curatedByNumber } from '../lib/ling-curated';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-beginner-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { beginnerCourse, beginnerCourses, learnKey, learnPath, learnPaths, learnProblems, learnSolved } = await import(
  '../lib/server/beginner-courses'
);
const { SELF_PACED, certificateById } = await import('../lib/server/certificates');
const { DIAGRAM_MAX_LENGTH } = await import('../lib/course-diagram');

const COURSE = ['chapters', 'slug', 'summaryEn', 'summaryZh', 'titleEn', 'titleZh'];
const CHAPTER = ['bodyEn', 'bodyZh', 'homework', 'quiz', 'slug', 'solves', 'titleEn', 'titleZh'];
const QUESTION = ['answer', 'choices', 'qEn', 'qZh', 'whyEn', 'whyZh'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

before(() => migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') }));
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('two courses of complete bilingual chapters, quizzes and three practice problems each', () => {
  assert.deepEqual(Object.keys(file), ['courses']);
  assert.deepEqual(
    beginnerCourses.map((c) => [c.slug, c.chapters.length]),
    [
      ['big-o', 10],
      ['python', 8],
    ],
  );
  const bad: string[] = [];
  for (const course of file.courses as Record<string, unknown>[]) {
    assert.deepEqual(Object.keys(course).sort(), COURSE);
    for (const key of ['titleZh', 'titleEn', 'summaryZh', 'summaryEn']) if (!text(course[key])) bad.push(`${course.slug}.${key}`);
    const slugs = new Set<string>();
    for (const chapter of course.chapters as Record<string, unknown>[]) {
      const at = `${course.slug}/${chapter.slug}`;
      assert.deepEqual(Object.keys(chapter).sort(), CHAPTER, at);
      if (!SLUG.test(String(chapter.slug)) || slugs.has(String(chapter.slug))) bad.push(`${at}: slug`);
      slugs.add(String(chapter.slug));
      for (const key of ['titleZh', 'titleEn', 'bodyZh', 'bodyEn']) if (!text(chapter[key])) bad.push(`${at}.${key}: empty`);
      for (const key of ['bodyZh', 'bodyEn']) {
        const body = String(chapter[key]);
        // The page owns the h1; diagrams are titled for screen readers and within the renderer's limit.
        if (/^# /m.test(body.replace(/^```[\s\S]*?^```/gm, ''))) bad.push(`${at}.${key}: has an h1`);
        for (const [, source] of body.matchAll(/^```mermaid\n([\s\S]*?)^```/gm))
          if (source.length > DIAGRAM_MAX_LENGTH || !/accTitle: /.test(source)) bad.push(`${at}.${key}: diagram`);
        // Pages link problems themselves; the renderer would print a relative link as text.
        if (/\]\(\//.test(body)) bad.push(`${at}.${key}: relative link`);
      }
      if (!/[一-鿿]/.test(String(chapter.bodyZh))) bad.push(`${at}.bodyZh: no Chinese`);
      const quiz = chapter.quiz as Record<string, unknown>[];
      if (quiz.length !== 3) bad.push(`${at}: ${quiz.length} questions`);
      for (const [q, question] of quiz.entries()) {
        assert.deepEqual(Object.keys(question).sort(), QUESTION, `${at}.quiz[${q}]`);
        for (const key of ['qZh', 'qEn', 'whyZh', 'whyEn']) if (!text(question[key])) bad.push(`${at}.quiz[${q}].${key}`);
        const choices = question.choices as { zh: string; en: string }[];
        if (choices.length !== 4 || !choices.every((c) => text(c.zh) && text(c.en))) bad.push(`${at}.quiz[${q}].choices`);
        if (!Number.isInteger(question.answer) || !choices[question.answer as number]) bad.push(`${at}.quiz[${q}].answer`);
      }
      const homework = chapter.homework as { id: string; zh: string; en: string }[];
      if (homework.length !== 3) bad.push(`${at}: ${homework.length} problems`);
      for (const problem of homework) {
        // Line 500 problems: judged here with a LeetCode-mode contract.
        if (!curatedByNumber.has(Number(/^lc-(\d+)$/.exec(problem.id)?.[1]))) bad.push(`${at}: ${problem.id} not in Line 500`);
        if (!Object.hasOwn(contracts.problems, problem.id)) bad.push(`${at}: ${problem.id} has no contract`);
        if (!text(problem.zh) || !text(problem.en)) bad.push(`${at}: ${problem.id} title`);
      }
      for (const id of chapter.solves as string[]) if (!/^lc-\d+$/.test(id)) bad.push(`${at}: solves ${id}`);
      // Every Big-O lesson explains with a diagram, in both languages.
      if (course.slug === 'big-o')
        for (const key of ['bodyZh', 'bodyEn'])
          if (!/^```mermaid\n/m.test(String(chapter[key]))) bad.push(`${at}.${key}: no diagram`);
    }
  }
  assert.deepEqual(bad, []);
});

void test('quiz answers sit in every position and are rarely the longest choice', () => {
  const questions = beginnerCourses.flatMap((c) => c.chapters.flatMap((chapter) => chapter.quiz));
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
  assert.ok(Math.max(...at) <= questions.length * 0.3, `answer positions ${at}`);
  assert.ok(longest <= questions.length * 2 * 0.3, `the answer is the longest choice ${longest} times`);
});

void test('problems a lesson solves or assigns are known, so exams and duels can leave them out', () => {
  // Worked examples, read off the lessons' code; a few are not practice anywhere.
  for (const id of ['lc-1', 'lc-876', 'lc-1046', 'lc-746', 'lc-2300', 'lc-102', 'lc-217']) assert.ok(learnSolved.has(id), id);
  assert.ok(!learnSolved.has('lc-226'), 'Invert Binary Tree is left to the learner');
  for (const chapter of beginnerCourses.flatMap((c) => c.chapters))
    for (const id of [...chapter.solves, ...chapter.homework.map((h) => h.id)]) assert.ok(learnProblems.has(id), id);
});

void test('paths, lookups and the self-paced course behind each course', () => {
  assert.equal(beginnerCourse('python')?.titleEn, 'Python for Coding Interviews');
  assert.equal(beginnerCourse('__proto__'), undefined);
  assert.equal(learnPath(), '/learn');
  assert.equal(learnPath('big-o', 'heaps'), '/learn/big-o/heaps');
  const paths = learnPaths().map((p) => p.path);
  assert.equal(paths.length, 1 + 2 + 18);
  assert.equal(new Set(paths).size, paths.length);
  assert.ok(paths.includes('/learn/python/pitfalls'));
  const python = SELF_PACED.find((c) => c.id === 'sd:python')!;
  assert.equal(python.zh, 'Python 面试速成课');
  assert.deepEqual(
    python.targets,
    beginnerCourse('python')!.chapters.map((c) => `sd:${learnKey('python', c.slug)}`),
  );
});

void test('reading every chapter of a course issues its certificate, titled and counted', async () => {
  const me: Person = { id: 'learn-me', name: 'Me', email: 'me@example.test', role: 'student', verified: true };
  sqlite()
    .prepare('INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,1,0,0)')
    .run(me.id, me.name, me.email);
  const mark = async (target: string) => {
    const url = new URL('https://cswork.test/api/oj/marks');
    const response = await handleOj(
      new Request(url, {
        method: 'POST',
        body: JSON.stringify({ target, mark: 'read', on: true }),
        headers: { 'Content-Type': 'application/json' },
      }),
      me,
      ['marks'],
    );
    return ((await response.json()) as { certificate: string | null }).certificate;
  };
  const targets = SELF_PACED.find((c) => c.id === 'sd:python')!.targets;
  for (const target of targets.slice(0, -1)) assert.equal(await mark(target), null);
  const id = await mark(targets.at(-1)!);
  assert.ok(id);
  const cert = certificateById(id, false)!;
  assert.deepEqual([cert.course, cert.lessons, cert.skill], ['Python for Coding Interviews', 8, false]);
});
