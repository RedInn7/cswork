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
import sqlTrack from '../lib/content/sql-track.json';
import { curatedByNumber } from '../lib/ling-curated';
import { isDemoKind } from '../lib/algorithm-demo';
import { SORT_ALGOS } from '../lib/algorithm-demo-sorts';
import { wholeProgram } from '../lib/course-snippet';
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
/** Courses whose lessons run code (scripts/learn/check-snippets.mjs builds every run block). */
const RUN = { cpp: 'cpp', java: 'java', go: 'go', sql: 'sql' } as Record<string, string>;
/** The SQL course practises on the SQL track: links to its topics and patterns, never sql-* homework. */
const TRACK_LINK = /\]\((\/[^)]*)\)/g;
const trackLink = (href: string) => {
  const m = /^\/\?view=problems&library=sql(?:&pattern=([a-z-]+)|#sql-group-([a-z]+))?$/.exec(href);
  return !!m && (!m[1] || sqlTrack.patterns.some((p) => p.key === m[1])) && (!m[2] || sqlTrack.groups.some((g) => g.key === m[2]));
};
const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

before(() => migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') }));
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

void test('six courses of complete bilingual chapters, quizzes and practice', () => {
  assert.deepEqual(Object.keys(file), ['courses']);
  assert.deepEqual(
    beginnerCourses.map((c) => [c.slug, c.chapters.length]),
    [
      ['big-o', 10],
      ['python', 8],
      ['cpp', 8],
      ['java', 8],
      ['go', 7],
      ['sql', 6],
    ],
  );
  assert.equal(new Set(beginnerCourses.map((c) => c.slug)).size, beginnerCourses.length, 'course slugs repeat');
  const bad: string[] = [];
  for (const course of file.courses as Record<string, unknown>[]) {
    assert.deepEqual(Object.keys(course).sort(), COURSE);
    const assigned = new Set<string>();
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
        // Pages link problems themselves; the renderer prints other relative links as text.
        for (const [, href] of body.matchAll(TRACK_LINK))
          if (course.slug !== 'sql' || !trackLink(href)) bad.push(`${at}.${key}: relative link ${href}`);
        // Code the lesson runs is a whole program (or one query) and comes with what it prints.
        const runs = [...body.matchAll(/^```(\w+) run\n([\s\S]*?)^```/gm)];
        if (RUN[String(course.slug)] && !runs.length) bad.push(`${at}.${key}: no run block`);
        const shown = body.match(/^```\w+ run\n[\s\S]*?^```\n\n```text\n/gm)?.length ?? 0;
        if (shown !== runs.length) bad.push(`${at}.${key}: a run block without the output it prints`);
        for (const [, language, code] of runs) {
          if (language !== RUN[String(course.slug)]) bad.push(`${at}.${key}: ${language} run block`);
          if (language === 'java' && !/^(public )?class Main \{/m.test(code)) bad.push(`${at}.${key}: no class Main`);
          if (language === 'go' && !code.startsWith('package main\n')) bad.push(`${at}.${key}: not package main`);
          if (/^(cpp|java|go)$/.test(language) && !/\bmain\b/.test(code)) bad.push(`${at}.${key}: no main`);
        }
      }
      // The same programs in both languages, comments aside.
      const runCount = (body: unknown) => String(body).match(/^```\w+ run$/gm)?.length ?? 0;
      if (runCount(chapter.bodyZh) !== runCount(chapter.bodyEn)) bad.push(`${at}: run blocks differ`);
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
      // SQL lessons send learners to the SQL track instead: sql-* homework would shrink the SQL exam's pool.
      if (homework.length !== (course.slug === 'sql' ? 0 : 3)) bad.push(`${at}: ${homework.length} problems`);
      if (course.slug === 'sql' && !/\]\(\/\?view=problems&library=sql/.test(String(chapter.bodyZh)))
        bad.push(`${at}: no SQL track link`);
      for (const problem of homework) {
        if (assigned.has(problem.id)) bad.push(`${at}: ${problem.id} assigned twice`);
        assigned.add(problem.id);
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

void test('quiz answers sit in every position and are sometimes, not usually, the longest choice', () => {
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
  // Bounded both ways: an answer that is never the longest choice is as much a tell as one that always is.
  assert.ok(longest <= questions.length * 2 * 0.3, `the answer is the longest choice ${longest} times`);
  assert.ok(longest >= questions.length * 2 * 0.1, `the answer is the longest choice only ${longest} times`);
});

void test('problems a lesson solves or assigns are known, so exams and duels can leave them out', () => {
  // Worked examples, read off the lessons' code; a few are not practice anywhere.
  for (const id of ['lc-1', 'lc-876', 'lc-1046', 'lc-746', 'lc-2300', 'lc-102', 'lc-217']) assert.ok(learnSolved.has(id), id);
  assert.ok(!learnSolved.has('lc-226'), 'Invert Binary Tree is left to the learner');
  // Homework is fresh practice: never a problem some lesson's text already solves.
  const retyped = beginnerCourses.flatMap((c) =>
    c.chapters.flatMap((ch) => ch.homework.filter((h) => learnSolved.has(h.id)).map((h) => `${c.slug}/${ch.slug}: ${h.id}`)),
  );
  assert.deepEqual(retyped, []);
  for (const chapter of beginnerCourses.flatMap((c) => c.chapters))
    for (const id of [...chapter.solves, ...chapter.homework.map((h) => h.id)]) assert.ok(learnProblems.has(id), id);
});

void test('the language and SQL courses reuse Big-O and Python problems, so no draw pool shrinks', () => {
  const base = beginnerCourses.filter((c) => c.slug === 'big-o' || c.slug === 'python');
  const used = new Set(base.flatMap((c) => c.chapters.flatMap((ch) => [...ch.solves, ...ch.homework.map((h) => h.id)])));
  assert.deepEqual([...learnProblems].filter((id) => !used.has(id)), []);
  assert.ok(![...learnProblems].some((id) => id.startsWith('sql-') || id.startsWith('pd-')), 'the SQL exam keeps its pool');
});

void test('paths, lookups and the self-paced course behind each course', () => {
  assert.equal(beginnerCourse('python')?.titleEn, 'Python for Coding Interviews');
  assert.equal(beginnerCourse('__proto__'), undefined);
  assert.equal(learnPath(), '/learn');
  assert.equal(learnPath('big-o', 'heaps'), '/learn/big-o/heaps');
  const paths = learnPaths().map((p) => p.path);
  assert.equal(paths.length, 1 + beginnerCourses.length + beginnerCourses.reduce((n, c) => n + c.chapters.length, 0));
  assert.equal(new Set(paths).size, paths.length);
  assert.ok(paths.includes('/learn/python/pitfalls'));
  assert.ok(paths.includes('/learn/cpp/cheatsheet'));
  // Every course, the new ones included, issues its own certificate.
  assert.deepEqual(
    SELF_PACED.filter((c) => c.id.startsWith('sd:') && c.id !== 'sd:system-design').map((c) => c.id),
    beginnerCourses.map((c) => `sd:${c.slug}`),
  );
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

void test('Big-O: every Python snippet has C++, Java and Go tabs, and every lesson animates its structure', () => {
  const course = beginnerCourse('big-o')!;
  const bad: string[] = [];
  for (const chapter of course.chapters) {
    const kinds: Record<string, string[]> = {};
    for (const key of ['bodyZh', 'bodyEn'] as const) {
      const body = chapter[key];
      const at = `${chapter.slug}.${key}`;
      // A python block, then cpp, java and go with only blank lines between: one tab group (lib/remark-code-tabs.ts).
      const python = body.match(/^```python\n/gm)?.length ?? 0;
      const grouped = body.match(/^```python\n[\s\S]*?^```\n\n```cpp\n[\s\S]*?^```\n\n```java\n[\s\S]*?^```\n\n```go\n[\s\S]*?^```$/gm)?.length ?? 0;
      if (!python || grouped !== python) bad.push(`${at}: ${grouped} of ${python} python blocks have all three tabs`);
      for (const language of ['cpp', 'java', 'go'])
        if ((body.match(new RegExp(`^\`\`\`${language}\n`, 'gm'))?.length ?? 0) !== python) bad.push(`${at}: ${language} blocks`);
      kinds[key] = [...body.matchAll(/^```algorithm-demo\n([^\n]*)\n```$/gm)].map((m) => m[1]);
      if (!kinds[key].length) bad.push(`${at}: no demo`);
      for (const kind of kinds[key]) if (!isDemoKind(kind)) bad.push(`${at}: unknown demo ${kind}`);
    }
    if (kinds.bodyZh.join() !== kinds.bodyEn.join()) bad.push(`${chapter.slug}: demos differ between languages`);
    if (chapter.slug === 'sorting' && SORT_ALGOS.some((algo) => !kinds.bodyZh.includes(`sort-${algo}`))) bad.push('sorting: a sort is missing');
    if (chapter.slug === 'complexity' && !kinds.bodyZh.includes('sort-insertion')) bad.push('complexity: no insertion sort');
  }
  assert.deepEqual(bad, []);
});

void test('wholeProgram wraps a snippet without a main and leaves whole programs and Python alone', () => {
  assert.equal(wholeProgram('cpp', 'int f() { return 1; }\n'), '#include <bits/stdc++.h>\nusing namespace std;\n\nint f() { return 1; }\n\nint main() {}\n');
  assert.equal(wholeProgram('cpp', 'int main() { return 0; }'), 'int main() { return 0; }');
  assert.equal(
    wholeProgram('java', 'import java.util.*;\n\nstatic int f(List<Integer> a) {\n    return a.size();\n}'),
    'import java.util.*;\n\npublic class Main {\n    static int f(List<Integer> a) {\n        return a.size();\n    }\n\n    public static void main(String[] args) {}\n}\n',
  );
  const java = 'public class Main {\n    public static void main(String[] args) {}\n}';
  assert.equal(wholeProgram('java', java), java);
  assert.equal(wholeProgram('go', 'func f() int { return 1 }'), 'package main\n\nfunc f() int { return 1 }\n\nfunc main() {}\n');
  assert.equal(wholeProgram('go', 'package main\n\nfunc main() {}'), 'package main\n\nfunc main() {}');
  assert.equal(wholeProgram('python', 'def f(): pass'), 'def f(): pass');
});
