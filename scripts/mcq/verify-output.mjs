/**
 * Runs every "what does this print" question of lib/content/oa-mcq.json (code-output, except the
 * complexity topic, which asks for a big-O) and checks the right choice is exactly what the code
 * prints, trailing newline aside. C++ builds with $CXX (default g++) -std=c++17 -O0; a question
 * marked `ub: true` is undefined behaviour and is not run. A right choice of "Compile error" means
 * the build must fail. JavaScript runs on node, Python on python3, Java (when the runner has it)
 * as class Main. A SQL question is a script whose last statement is the query: the rest runs
 * first, then the query's rows print one per line, values joined by " | " and NULL as NULL.
 * A language whose toolchain is missing is skipped with a note.
 *
 *   node scripts/mcq/verify-output.mjs [topic…]
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const CXX = process.env.CXX || 'g++';
const RUN = {
  cpp: ['main.cpp', [CXX, '-std=c++17', '-O0', '-o', 'main', 'main.cpp'], ['./main']],
  javascript: ['main.js', null, ['node', 'main.js']],
  python: ['main.py', null, ['python3', 'main.py']],
  java: ['Main.java', ['javac', '-encoding', 'UTF-8', 'Main.java'], ['java', '-cp', '.', 'Main']],
};
const has = (command, flag = '--version') => spawnSync(command, [flag], { encoding: 'utf8' }).error === undefined;

function exec([command, ...args], cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 30_000 });
  return { ok: result.status === 0, stdout: result.stdout ?? '', stderr: result.stderr || String(result.error ?? '') };
}

/** { built: false } when the build failed; else { out } with what it printed, or { error }. */
function runProgram(lang, code) {
  const [file, build, run] = RUN[lang];
  const dir = mkdtempSync(join(tmpdir(), 'cswork-mcq-'));
  try {
    writeFileSync(join(dir, file), code);
    if (build) {
      const built = exec(build, dir);
      if (!built.ok) return { built: false, error: built.stderr };
    }
    const ran = exec(run, dir);
    return ran.ok ? { built: true, out: ran.stdout } : { built: true, error: `run failed\n${ran.stderr}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The rows of a SQL script's last statement, on a fresh in-memory database. */
export function runSql(code) {
  const db = new Database(':memory:');
  try {
    const statements = code.trim().replace(/;\s*$/, '').split(/;\s*\n/);
    db.exec(statements.slice(0, -1).join(';\n') + ';');
    const rows = db.prepare(statements.at(-1)).raw().all();
    return { built: true, out: rows.map((row) => row.map((v) => (v === null ? 'NULL' : String(v))).join(' | ')).join('\n') };
  } catch (error) {
    return { built: true, error: String(error) };
  } finally {
    db.close();
  }
}

/** What a question claims and what running it gave, or null when it is not run here. */
export function check(q, tools) {
  if (q.section !== 'code-output' || q.topic === 'complexity' || q.ub) return null;
  if (q.lang !== 'sql' && !tools[q.lang]) return { skipped: q.lang };
  const expected = q.en.choices[q.answer[0]];
  const result = q.lang === 'sql' ? runSql(q.code) : runProgram(q.lang, q.code);
  if (expected === 'Compile error') return { ok: result.built === false, got: result.error ?? result.out, expected };
  if (result.error !== undefined) return { ok: false, got: result.error, expected };
  return { ok: q.answer.length === 1 && result.out.replace(/\n$/, '') === expected, got: result.out, expected };
}

if (process.argv[1]?.endsWith('verify-output.mjs')) {
  const only = process.argv.slice(2);
  const bank = JSON.parse(readFileSync('lib/content/oa-mcq.json', 'utf8')).questions;
  const tools = { cpp: has(CXX), javascript: true, python: has('python3'), java: has('javac', '-version') && has('java', '-version') };
  const counts = {};
  const failures = [];
  for (const q of bank.filter((q) => !only.length || only.includes(q.topic))) {
    const result = check(q, tools);
    if (!result) continue;
    const key = result.skipped ? `${result.skipped} skipped` : q.lang;
    counts[key] = (counts[key] ?? 0) + 1;
    if (result.ok === false) failures.push(`${q.id} (${q.lang}): printed\n${result.got}\nexpected\n${result.expected}`);
  }
  console.log(Object.entries(counts).map(([k, n]) => `${k}: ${n}`).join(', ') || 'nothing to run');
  if (failures.length) {
    console.error(failures.join('\n\n'));
    process.exit(1);
  }
}
