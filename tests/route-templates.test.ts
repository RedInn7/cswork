// Every Line 500 template must compile and give the right answers in all four languages.
// Each stop has a small driver per language; the program is template + driver, and its
// stdout must equal `expected`. A language whose toolchain is missing is skipped.
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { ROUTE_SECTIONS } from '../lib/route-stops';
import { SITEMAP_STATIC_ENTRIES } from '../lib/seo';
import {
  TEMPLATE_LANGS,
  commentStart,
  line500Path,
  routeTemplates,
  templateFor,
  type TemplateLang,
} from '../lib/route-templates';
import { DRIVERS, driverProgram, normalizeOutput } from '../lib/route-template-drivers';

const CXX = process.env.CXX || 'g++';
/** The commands that build and run driverProgram()'s file. */
const STEPS: Record<TemplateLang, [string, string[]][]> = {
  python: [['python3', ['main.py']]],
  cpp: [[CXX, ['-std=c++17', '-o', 'main', 'main.cpp']], ['./main', []]],
  java: [['java', ['Main.java']]],
  go: [['go', ['run', 'main.go']]],
};

const has = (cmd: string, args: string[]) => spawnSync(cmd, args, { stdio: 'ignore' }).status === 0;
const TOOLCHAINS: Record<TemplateLang, boolean> = {
  python: has('python3', ['--version']),
  cpp: has(CXX, ['--version']),
  java: has('java', ['-version']) && has('javac', ['-version']),
  go: has('go', ['version']),
};
const exec = promisify(execFile);

void test('every Line 500 stop has a complete bilingual template, in route order', () => {
  const slugs = ROUTE_SECTIONS.flatMap((section) => section.slugs);
  assert.equal(routeTemplates.length, 35);
  assert.deepEqual(routeTemplates.map((t) => t.slug), slugs);
  assert.deepEqual(Object.keys(DRIVERS).sort(), [...slugs].sort());
  const cjk = /[一-鿿]/;
  for (const t of routeTemplates) {
    assert.equal(templateFor(t.slug), t);
    assert.equal(t.points.length, 3, t.slug);
    assert.equal(t.pitfalls.length, 3, t.slug);
    for (const text of [t.pattern, ...t.points, ...t.pitfalls]) {
      assert(cjk.test(text.zh), `${t.slug}: zh text should be Chinese`);
      assert(text.en.trim() && !cjk.test(text.en), `${t.slug}: en text should be English`);
    }
    assert(/O\(/.test(t.complexity.zh) && /O\(/.test(t.complexity.en), t.slug);
    assert(!cjk.test(t.complexity.en), `${t.slug}: en complexity should be English`);
    for (const [lang] of TEMPLATE_LANGS) {
      assert(t.code[lang].trim().length > 0, `${t.slug} ${lang}`);
      assert(!t.code[lang].includes('"fmt"'), `${t.slug}: the Go harness imports fmt`);
    }
  }
  assert.equal(templateFor('no-such-stop'), undefined);
  assert.equal(line500Path('binary-search'), '/?view=problems&section=binary-search');
});

void test('topic pages are in the sitemap; code comments are found outside literals', () => {
  const paths = new Set(SITEMAP_STATIC_ENTRIES.map((entry) => entry.path));
  assert(paths.has('/topics'));
  for (const t of routeTemplates) assert(paths.has(`/topics/${t.slug}`), t.slug);
  assert.equal(commentStart('x = "a#b"  # note', 'python'), 11);
  assert.equal(commentStart("c = '/'; // ok", 'cpp'), 9);
  assert.equal(commentStart('s := "//"', 'go'), -1);
});

const limit = Math.max(1, Math.min(3, availableParallelism() - 1));
for (const [lang, label] of TEMPLATE_LANGS) {
  void test(
    `${label} templates compile and print the expected answers`,
    { skip: !TOOLCHAINS[lang] && `${label} toolchain not installed`, timeout: 600_000 },
    async () => {
      const root = mkdtempSync(join(tmpdir(), `route-templates-${lang}-`));
      const failures: string[] = [];
      try {
        const queue = [...routeTemplates];
        const worker = async () => {
          for (let t = queue.shift(); t; t = queue.shift()) {
            const driver = DRIVERS[t.slug];
            const dir = mkdtempSync(join(root, `${t.slug}-`));
            const run = driverProgram(lang, t.code[lang], driver[lang]);
            writeFileSync(join(dir, run.file), run.source);
            let stdout = '';
            try {
              for (const [cmd, args] of STEPS[lang])
                ({ stdout } = await exec(cmd, args, { cwd: dir, timeout: 120_000 }));
            } catch (error) {
              const e = error as { stderr?: string; message: string };
              failures.push(`${t.slug}: ${(e.stderr || e.message).slice(0, 1500)}`);
              continue;
            }
            if (normalizeOutput(stdout) !== driver.expected)
              failures.push(`${t.slug}: expected\n${driver.expected}\ngot\n${normalizeOutput(stdout)}`);
          }
        };
        await Promise.all(Array.from({ length: limit }, worker));
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
      assert.deepEqual(failures, []);
    },
  );
}
