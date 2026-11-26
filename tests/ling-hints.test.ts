import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import hints from '../lib/content/ling-hints.json';
import { forReader } from '../lib/language';
import { curatedEntries } from '../lib/ling-curated';
import { lingHints } from '../lib/server/study-library';
import { TRANSLATED, scriptProblem } from '../scripts/oa-judge/text-checks.mjs';

// Room above today's longest (119 zh chars / 220 en chars) for a later refresh.
const MAX = { zh: 160, en: 320 } as const;

void test('every Line 500 problem has exactly three zh and three en hints, nothing else', () => {
  const file = hints as Record<string, { zh: unknown; en: unknown }>;
  const ids = curatedEntries.map((entry) => `lc-${entry.number}`);
  assert.deepEqual(Object.keys(file).sort(), [...ids].sort());
  const bad: string[] = [];
  for (const id of ids) {
    const entry = file[id];
    assert.deepEqual(Object.keys(entry).sort(), ['en', 'zh'], id);
    for (const lang of ['zh', 'en'] as const) {
      const list = entry[lang];
      if (!Array.isArray(list) || list.length !== 3) {
        bad.push(`${id}.${lang}: not 3 hints`);
        continue;
      }
      list.forEach((hint, i) => {
        if (typeof hint !== 'string' || !hint.trim())
          bad.push(`${id}.${lang}[${i}]: empty`);
        else if (hint.length > MAX[lang])
          bad.push(`${id}.${lang}[${i}]: ${hint.length} > ${MAX[lang]} chars`);
        // Hints point the way; code (fenced or inline) is a solution.
        else if (hint.includes('`'))
          bad.push(`${id}.${lang}[${i}]: contains code`);
      });
    }
  }
  assert.deepEqual(bad, []);
});

void test('only server code imports the hint file, so it stays out of client bundles', () => {
  const importers = ['app', 'components', 'hooks', 'lib']
    .flatMap((dir) =>
      (readdirSync(dir, { recursive: true }) as string[]).map((f) => join(dir, f)),
    )
    .filter((f) => /\.(tsx?|mjs)$/.test(f) && statSync(f).isFile() && /ling-hints\.(\w+\.)?json/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(importers, [join('lib', 'server', 'study-library.ts')]);
});

void test('ja/ko/vi hint files hold three hints, in their own language, for problems that have hints', () => {
  const base = hints as Record<string, unknown>;
  const bad: string[] = [];
  for (const lang of TRANSLATED as ('ja' | 'ko' | 'vi')[]) {
    const file = JSON.parse(readFileSync(`lib/content/ling-hints.${lang}.json`, 'utf8')) as Record<string, unknown>;
    for (const [id, list] of Object.entries(file)) {
      if (!Object.hasOwn(base, id)) bad.push(`${lang} ${id}: not in ling-hints.json`);
      else if (!Array.isArray(list) || list.length !== 3 || list.some((hint) => typeof hint !== 'string' || !hint.trim()))
        bad.push(`${lang} ${id}: not 3 non-empty hints`);
      else if (list.some((hint) => scriptProblem(lang, hint) || hint.includes('`'))) bad.push(`${lang} ${id}: not written in ${lang}, or contains code`);
      else assert.deepEqual(lingHints(id)?.[lang], list);
    }
  }
  assert.deepEqual(bad, []);
  // A reader is sent Chinese, English and their own language only.
  const all = { zh: ['一'], en: ['one'], ja: ['いち'], ko: ['하나'] };
  assert.deepEqual(forReader(all, 'ja'), { zh: ['一'], en: ['one'], ja: ['いち'] });
  assert.deepEqual(forReader(all, null), { zh: ['一'], en: ['one'] });
});
