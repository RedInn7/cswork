import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ACM_IO_TEMPLATES } from '../lib/acm-io-templates';
import type { Language } from '../lib/problems';

const toolchains: Record<
  Language,
  { probe: string[]; file: string; build?: string[]; run: string[] }
> = {
  python: { probe: ['python3', '--version'], file: 'main.py', run: ['python3', 'main.py'] },
  cpp: {
    probe: ['g++', '--version'],
    file: 'main.cpp',
    build: ['g++', '-std=c++17', '-O0', '-o', 'main', 'main.cpp'],
    run: ['./main'],
  },
  java: {
    probe: ['javac', '-version'],
    file: 'Main.java',
    build: ['javac', 'Main.java'],
    run: ['java', '-cp', '.', 'Main'],
  },
  go: {
    probe: ['go', 'version'],
    file: 'main.go',
    build: ['go', 'build', '-o', 'main', 'main.go'],
    run: ['./main'],
  },
};
const exec = ([command, ...args]: string[], cwd: string, input = '') =>
  spawnSync(command, args, { cwd, input, encoding: 'utf8', timeout: 120_000 });
const available = (language: Language) =>
  exec(toolchains[language].probe, tmpdir()).status === 0;
// Token-based in every language, so one token per line must give the same answer.
const anyLayout = new Set(['single', 'array', 'graph', 'join', 'fast']);

void test('every template is bilingual, complete and uniquely named', () => {
  assert.equal(ACM_IO_TEMPLATES.length, 12);
  assert.equal(new Set(ACM_IO_TEMPLATES.map((item) => item.id)).size, 12);
  for (const item of ACM_IO_TEMPLATES) {
    for (const text of [item.title, item.note])
      assert.ok(text.zh.trim() && text.en.trim(), item.id);
    for (const language of Object.keys(toolchains) as Language[])
      assert.ok(item.code[language].endsWith('\n'), `${item.id} ${language}`);
    assert.ok(item.sample.output.endsWith('\n'), item.id);
  }
});

// Python always runs; compilers that are missing locally are skipped (CI has all four).
for (const language of Object.keys(toolchains) as Language[]) {
  const ok = language === 'python' || available(language);
  void test(`${language} templates print the sample output`, { skip: !ok && `no ${language} toolchain` }, () => {
    const { file, build, run } = toolchains[language];
    for (const item of ACM_IO_TEMPLATES) {
      const dir = mkdtempSync(join(tmpdir(), `acm-io-${language}-`));
      try {
        writeFileSync(join(dir, file), item.code[language]);
        if (build) {
          const built = exec(build, dir);
          assert.equal(built.status, 0, `${item.id}: ${built.stderr}`);
        }
        const inputs = [item.sample.input];
        if (anyLayout.has(item.id))
          inputs.push(`${item.sample.input.trim().split(/\s+/).join('\n')}\n`);
        for (const input of inputs) {
          const result = exec(run, dir, input);
          assert.equal(result.status, 0, `${item.id}: ${result.stderr}`);
          assert.equal(result.stdout, item.sample.output, item.id);
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });
}
