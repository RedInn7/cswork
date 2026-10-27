import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { trackEditorial } from '../lib/server/track-editorials';

// Each track's editorial file, its problem packages, and the languages its code may be in.
const TRACKS = [
  ['book', 'content/book-problems/packages.json', ['python', 'cpp', 'java', 'go']],
  ['core', 'content/core-skills/packages.json', ['python', 'cpp', 'java', 'go']],
  ['ml', 'content/ml-coding/packages.json', ['python']],
  ['rest', 'content/rest-api/packages.json', ['python']],
  ['sql', 'content/sql-track/packages.json', ['sql']],
  ['pandas', 'content/sql-track/pandas-packages.json', ['pandas']],
] as const;
const TEXT = ['ideaEn', 'ideaZh', 'nameEn', 'nameZh', 'space', 'time'];
const MAX = { name: 60, idea: 2000, cost: 40, code: 8000 } as const;
const BIG_O = String.raw`(?:[A-Za-z]+(?:/[A-Za-z]+)* )?O\([^()]*(?:\([^()]*\)[^()]*)*\)`;
const COST = new RegExp(`^${BIG_O}(?:, ${BIG_O})*$`);
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

for (const [track, packages, langs] of TRACKS)
  void test(`${track}: every problem has a 1-3 approach bilingual editorial with its own code`, () => {
    const file = read(`lib/content/track-editorials/${track}.json`) as Record<string, Record<string, unknown>>;
    const ids = new Set((read(packages) as { problem: { id: string } }[]).map((p) => p.problem.id));
    const bad: string[] = [];
    for (const id of ids) if (!Object.hasOwn(file, id)) bad.push(`${id}: no editorial`);
    for (const [id, entry] of Object.entries(file)) {
      if (!ids.has(id)) bad.push(`${id}: not a ${track} problem`);
      if (JSON.stringify(Object.keys(entry).sort()) !== '["approaches","verified"]') bad.push(`${id}: keys`);
      if (typeof entry.verified !== 'boolean') bad.push(`${id}.verified: not a boolean`);
      const approaches = entry.approaches as Record<string, unknown>[];
      if (!Array.isArray(approaches) || approaches.length < 1 || approaches.length > 3) {
        bad.push(`${id}: needs 1-3 approaches`);
        continue;
      }
      approaches.forEach((approach, i) => {
        const at = `${id}[${i}]`;
        const code = Object.keys(approach).filter((key) => !TEXT.includes(key));
        if (!code.length) bad.push(`${at}: no code`);
        for (const key of code) if (!(langs as readonly string[]).includes(key)) bad.push(`${at}.${key}: not a ${track} language`);
        for (const key of [...TEXT, ...code]) {
          const value = approach[key];
          const max = key.startsWith('name') ? MAX.name : key.startsWith('idea') ? MAX.idea : TEXT.includes(key) ? MAX.cost : MAX.code;
          if (typeof value !== 'string' || !value.trim()) bad.push(`${at}.${key}: empty`);
          else if (value.length > max) bad.push(`${at}.${key}: ${value.length} > ${max} chars`);
        }
        for (const key of ['time', 'space'])
          if (!COST.test(String(approach[key])) || /[一-鿿]/.test(String(approach[key]))) bad.push(`${at}.${key}: not big-O`);
        if (!/[一-鿿]/.test(String(approach.ideaZh))) bad.push(`${at}.ideaZh: no Chinese`);
      });
    }
    assert.deepEqual(bad, []);
  });

void test('the loader returns a track editorial by id and nothing for others', () => {
  const [first] = Object.keys(read('lib/content/track-editorials/core.json'));
  if (first) assert.ok(trackEditorial(first)?.approaches.length);
  assert.equal(trackEditorial('lc-1'), null);
  assert.equal(trackEditorial('constructor'), null);
});
