import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { oaWrittenEditorial } from '../lib/server/oa-written-editorials';

const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const LANGS = new Set(['python', 'java', 'cpp', 'go', 'javascript', 'typescript', 'sql', 'text']);

void test('every OA problem not judged here has a written editorial', () => {
  const judged = new Set((read('content/oa-judge/registry.json').items as { id: string }[]).map((item) => item.id));
  const items = (read('content/oa-master/catalog.json').items as { id: string }[]).filter((item) => !judged.has(item.id));
  const files = new Set(
    readdirSync('content/oa-master/editorials')
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.replace(/\.json$/, '')),
  );
  const bad: string[] = [];
  for (const { id } of items) {
    const editorial = oaWrittenEditorial(id);
    if (!editorial) {
      bad.push(`${id}: ${files.has(id) ? 'invalid file' : 'no editorial'}`);
      continue;
    }
    if (!/[一-鿿]/.test(editorial.explanation)) bad.push(`${id}: explanation has no Chinese`);
    if (editorial.explanation.length < 150) bad.push(`${id}: explanation under 150 chars`);
    for (const { language } of editorial.solutions) if (!LANGS.has(language)) bad.push(`${id}: language ${language}`);
  }
  // Every judged problem has the longer write-up too; it replaces only the text, its code is the
  // registry's verified program.
  for (const id of judged) if (!files.has(id)) bad.push(`${id}: judged, no written editorial`);
  for (const id of files)
    if (judged.has(id)) {
      const editorial = oaWrittenEditorial(id);
      if (!editorial) bad.push(`${id}: invalid file`);
      else if (editorial.solutions.length) bad.push(`${id}: judged here, code must come from the registry`);
      else if (editorial.explanation.length < 600) bad.push(`${id}: judged write-up under 600 chars`);
    }
  assert.deepEqual(bad, []);
});

void test('the loader refuses ids outside the OA namespace', () => {
  assert.equal(oaWrittenEditorial('../registry'), null);
  assert.equal(oaWrittenEditorial('lc-1'), null);
});
