import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import editorials from '../lib/content/ling-editorials.json';
import { curatedByNumber } from '../lib/ling-curated';
import { lingEditorial } from '../lib/server/ling-editorials';

const FIELDS = ['cpp', 'ideaEn', 'ideaZh', 'nameEn', 'nameZh', 'python', 'space', 'time'];
// Room for a long DP idea or a verbose C++ solution; anything past this is a paste accident.
const MAX = { name: 60, idea: 1200, cost: 40, code: 6000 } as const;

void test('every editorial is a Line 500 problem with 1-4 complete bilingual approaches', () => {
  const file = editorials as Record<string, Record<string, unknown>>;
  assert.ok(Object.keys(file).length >= 2, 'the seed keeps at least two samples');
  const bad: string[] = [];
  for (const [id, entry] of Object.entries(file)) {
    const number = Number(/^lc-(\d+)$/.exec(id)?.[1]);
    if (!curatedByNumber.has(number)) bad.push(`${id}: not a Line 500 problem`);
    assert.deepEqual(Object.keys(entry).sort(), ['approaches', 'verified'], id);
    if (typeof entry.verified !== 'boolean') bad.push(`${id}.verified: not a boolean`);
    const approaches = entry.approaches;
    if (!Array.isArray(approaches) || approaches.length < 1 || approaches.length > 4) {
      bad.push(`${id}: needs 1-4 approaches`);
      continue;
    }
    approaches.forEach((approach: Record<string, unknown>, i) => {
      const at = `${id}[${i}]`;
      assert.deepEqual(Object.keys(approach).sort(), FIELDS, at);
      for (const key of FIELDS) {
        const value = approach[key];
        if (typeof value !== 'string' || !value.trim()) {
          bad.push(`${at}.${key}: empty`);
          continue;
        }
        const max = key.startsWith('name')
          ? MAX.name
          : key.startsWith('idea')
            ? MAX.idea
            : key === 'time' || key === 'space'
              ? MAX.cost
              : MAX.code;
        if (value.length > max) bad.push(`${at}.${key}: ${value.length} > ${max} chars`);
      }
      for (const key of ['time', 'space'])
        if (!/^O\(.+\)$/.test(String(approach[key]))) bad.push(`${at}.${key}: not big-O`);
      if (!/[一-鿿]/.test(String(approach.ideaZh))) bad.push(`${at}.ideaZh: no Chinese`);
    });
  }
  assert.deepEqual(bad, []);
});

void test('the loader returns an editorial by problem id and nothing for others', () => {
  const file = editorials as Record<string, unknown>;
  assert.ok(file['lc-1'], 'lc-1 has an editorial');
  assert.deepEqual(lingEditorial('lc-1'), file['lc-1']);
  assert.equal(lingEditorial('lc-999999'), null);
  assert.equal(lingEditorial('oa-x-1'), null);
  assert.equal(lingEditorial('__proto__'), null);
  assert.equal(lingEditorial('hasOwnProperty'), null);
});

void test('only the server loader imports the editorial file, so it stays out of client bundles', () => {
  const importers = ['app', 'components', 'hooks', 'lib']
    .flatMap((dir) =>
      (readdirSync(dir, { recursive: true }) as string[]).map((f) => join(dir, f)),
    )
    .filter(
      (f) =>
        /\.(tsx?|mjs)$/.test(f) &&
        statSync(f).isFile() &&
        /from ['"][^'"]*ling-editorials\.json['"]/.test(readFileSync(f, 'utf8')),
    );
  assert.deepEqual(importers, [join('lib', 'server', 'ling-editorials.ts')]);
});
