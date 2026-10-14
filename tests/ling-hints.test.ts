import assert from 'node:assert/strict';
import { test } from 'node:test';
import hints from '../lib/content/ling-hints.json';
import { curatedEntries } from '../lib/ling-curated';

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
