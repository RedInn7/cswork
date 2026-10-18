// Every Line 500 template, and each of its variants, must compile and give the right answers in
// all four languages. Each one has a small driver per language; the program is template + driver,
// and its stdout must equal `expected`. A language whose toolchain is missing is skipped.
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
  matrixFor,
  routeTemplates,
  templateFor,
  variantsFor,
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

/** The two stops with a variant matrix may have up to six variants; the others two to four. */
const MATRIX_STOPS = ['backtracking-enumeration', 'dp-knapsack'];

void test('every stop has 2–4 bilingual variants (6 with a matrix), each a complete four-language program', () => {
  const cjk = /[一-鿿]/;
  for (const t of routeTemplates) {
    const variants = variantsFor(t.slug);
    const max = MATRIX_STOPS.includes(t.slug) ? 6 : 4;
    assert(variants.length >= 2 && variants.length <= max, `${t.slug}: ${variants.length} variants`);
    const ids = variants.map((v) => v.id);
    assert.equal(new Set(ids).size, ids.length, `${t.slug}: ids are unique`);
    for (const v of variants) {
      const at = `${t.slug}/${v.id}`;
      assert.match(v.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, at);
      assert(v.id !== 'main' && v.id.length <= 40, at);
      for (const text of [v.pattern, v.when]) {
        assert(cjk.test(text.zh), `${at}: zh text should be Chinese`);
        assert(text.en.trim() && !cjk.test(text.en), `${at}: en text should be English`);
      }
      assert(/O\(/.test(v.complexity.zh) && /O\(/.test(v.complexity.en) && !cjk.test(v.complexity.en), at);
      assert(v.driver.expected.trim(), at);
      for (const [lang] of TEMPLATE_LANGS) {
        assert(v.code[lang].trim() && v.driver[lang].trim(), `${at} ${lang}`);
        assert(!v.code[lang].includes('"fmt"'), `${at}: the Go harness imports fmt`);
        assert.notEqual(v.code[lang], t.code[lang], `${at} ${lang}: a variant is another shape`);
      }
    }
  }
});

void test('variant matrices: their cells point at real code and quote it verbatim', () => {
  const cjk = /[一-鿿]/;
  assert.deepEqual(routeTemplates.filter((t) => matrixFor(t.slug)).map((t) => t.slug), MATRIX_STOPS);
  const shape = { 'backtracking-enumeration': [3, 3], 'dp-knapsack': [3, 5] } as Record<string, [number, number]>;
  for (const slug of MATRIX_STOPS) {
    const m = matrixFor(slug)!;
    assert.deepEqual([m.rows.length, m.cols.length], shape[slug], slug);
    assert.equal(m.cells.length, m.rows.length, slug);
    for (const text of [...m.rows, ...m.cols]) assert(cjk.test(text.zh) && text.en && !cjk.test(text.en), slug);
    const code = (id: string) => (id === 'main' ? templateFor(slug)!.code : variantsFor(slug).find((v) => v.id === id)?.code);
    for (const [r, row] of m.cells.entries()) {
      assert.equal(row.length, m.cols.length, `${slug} row ${r}`);
      for (const [c, cell] of row.entries()) {
        const at = `${slug} [${r}][${c}]`;
        if ('note' in cell) {
          assert(cjk.test(cell.note.zh) && cell.note.en && !cjk.test(cell.note.en), at);
          continue;
        }
        const target = code(cell.variant);
        assert(target, `${at}: no variant ${cell.variant}`);
        for (const [lang] of TEMPLATE_LANGS)
          for (const line of cell.key[lang].split('\n')) assert(line.trim() && target[lang].includes(line), `${at} ${lang}: ${line}`);
      }
    }
  }
  assert.equal(matrixFor('binary-search'), undefined);
  assert.deepEqual(variantsFor('no-such-stop'), []);
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
    { skip: !TOOLCHAINS[lang] && `${label} toolchain not installed`, timeout: 1_200_000 },
    async () => {
      const root = mkdtempSync(join(tmpdir(), `route-templates-${lang}-`));
      const failures: string[] = [];
      try {
        // Each main template with its DRIVERS entry, then each variant with its own driver.
        const queue = routeTemplates.flatMap((t) => [
          { slug: t.slug, code: t.code, driver: DRIVERS[t.slug] },
          ...variantsFor(t.slug).map((v) => ({ slug: `${t.slug}.${v.id}`, code: v.code, driver: v.driver })),
        ]);
        const worker = async () => {
          for (let t = queue.shift(); t; t = queue.shift()) {
            const driver = t.driver;
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
