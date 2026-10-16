/**
 * Runs the code the /learn crash courses (lib/content/beginner-courses.json) mark as runnable:
 * a ```cpp run, ```java run or ```go run block is a whole program, built and run with the local
 * toolchain the way scripts/core-skills/build.ts does it ($CXX or g++ -std=c++20, javac --release 17
 * with class Main, go -lang=go1.21: at or below the judge's g++ 14, Java 21 and Go 1.24). A
 * ```sql run block is one query, run with better-sqlite3 on the SQL track's sample tables
 * (scripts/sql-track/datasets.ts). When a ```text block follows a run block (blank lines between at
 * most), it is the output the lesson promises: stdout, or for SQL the column names and then one row
 * per line, values joined by " | " and NULL as NULL. Both languages of every chapter are checked;
 * a language whose toolchain is missing is skipped with a note.
 *
 *   node --import tsx scripts/learn/check-snippets.mjs [course…]
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';
import { APP, COMPANY, SCHEMAS, SCHOOL, SHOP } from '../sql-track/datasets.ts';

const BLOCK = /^```(cpp|java|go|sql) run\n([\s\S]*?)^```\n(?:[ \t]*\n)*(?:```text\n([\s\S]*?)^```$)?/gm;

/** Every run block of the chosen courses, once per distinct (language, code, expected output). */
export function snippets(courses) {
  const found = new Map();
  for (const course of courses)
    for (const chapter of course.chapters)
      for (const key of ['bodyZh', 'bodyEn'])
        for (const [, language, code, expected] of chapter[key].matchAll(BLOCK)) {
          const at = `${course.slug}/${chapter.slug} ${key}`;
          const id = JSON.stringify([language, code, expected ?? null]);
          if (!found.has(id)) found.set(id, { at, language, code, expected });
        }
  return [...found.values()];
}

function exec(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout: 60_000,
    env: { ...process.env, GOTOOLCHAIN: 'local', GOFLAGS: '', GO111MODULE: 'off', CGO_ENABLED: '0' },
  });
  return { ok: result.status === 0, stdout: result.stdout ?? '', stderr: result.stderr || String(result.error ?? '') };
}

const CXX = process.env.CXX || 'g++';
const BUILD = {
  cpp: ['main.cpp', [CXX, '-std=c++20', '-O2', '-o', 'main', 'main.cpp'], ['./main']],
  java: ['Main.java', ['javac', '--release', '17', '-encoding', 'UTF-8', 'Main.java'], ['java', '-cp', '.', 'Main']],
  go: ['main.go', ['go', 'build', '-gcflags=-lang=go1.21', '-o', 'main', 'main.go'], ['./main']],
};
const has = (command) => spawnSync(command, ['--version'], { encoding: 'utf8' }).error === undefined;

function runProgram(language, code) {
  const [file, build, run] = BUILD[language];
  const dir = mkdtempSync(join(tmpdir(), 'cswork-learn-'));
  try {
    writeFileSync(join(dir, file), code);
    const built = exec(build[0], build.slice(1), dir);
    if (!built.ok) return { ok: false, out: `build failed\n${built.stderr}` };
    const ran = exec(run[0], run.slice(1), dir);
    return ran.ok ? { ok: true, out: ran.stdout } : { ok: false, out: `run failed\n${ran.stderr}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The SQL track's sample tables, all four schemas in one in-memory database. */
export function sampleDatabase() {
  const db = new Database(':memory:');
  for (const [schema, data] of [
    ['company', COMPANY.sample],
    ['shop', SHOP.sample],
    ['school', SCHOOL.sample],
    ['app', APP.sample],
  ])
    for (const [table, create] of Object.entries(SCHEMAS[schema])) {
      db.exec(create);
      const rows = data[table] ?? [];
      if (rows.length) {
        const insert = db.prepare(`INSERT INTO ${table} VALUES (${rows[0].map(() => '?').join(', ')})`);
        for (const row of rows) insert.run(...row);
      }
    }
  return db;
}

export function runQuery(db, query) {
  try {
    const statement = db.prepare(query);
    if (!statement.reader) return { ok: false, out: 'not a query' };
    const names = statement.columns().map((column) => column.name);
    const rows = statement.raw().all();
    const cell = (value) => (value === null ? 'NULL' : String(value));
    return { ok: true, out: [names, ...rows].map((row) => row.map(cell).join(' | ')).join('\n') + '\n' };
  } catch (error) {
    return { ok: false, out: String(error) };
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const only = process.argv.slice(2);
  const { courses } = JSON.parse(readFileSync('lib/content/beginner-courses.json', 'utf8'));
  const chosen = courses.filter((course) => !only.length || only.includes(course.slug));
  const tools = { cpp: has(CXX), java: has('javac') && has('java'), go: spawnSync('go', ['version']).error === undefined };
  const db = sampleDatabase();
  const failures = [];
  const counts = {};
  for (const snippet of snippets(chosen)) {
    if (snippet.language !== 'sql' && !tools[snippet.language]) {
      counts[`${snippet.language} skipped`] = (counts[`${snippet.language} skipped`] ?? 0) + 1;
      continue;
    }
    const result = snippet.language === 'sql' ? runQuery(db, snippet.code) : runProgram(snippet.language, snippet.code);
    const wrong = result.ok && snippet.expected !== undefined && result.out.trimEnd() !== snippet.expected.trimEnd();
    if (!result.ok || wrong)
      failures.push(`${snippet.at} (${snippet.language}): ${wrong ? `printed\n${result.out}expected\n${snippet.expected}` : result.out}`);
    counts[snippet.language] = (counts[snippet.language] ?? 0) + 1;
  }
  console.log(Object.entries(counts).map(([language, n]) => `${language}: ${n}`).join(', ') || 'no run blocks');
  if (failures.length) {
    console.error(failures.join('\n\n'));
    process.exit(1);
  }
}
