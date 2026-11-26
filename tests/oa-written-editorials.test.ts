import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { oaExplanationLocal, oaWrittenEditorial } from '../lib/server/oa-written-editorials';
import { scriptProblem } from '../scripts/oa-judge/text-checks.mjs';

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

void test('ja/ko/vi editorials are written in their own language and keep the English one\'s code', () => {
  const fenced = (text: string) => text.match(/```[\s\S]*?```/g) ?? [];
  const bad: string[] = [];
  let translated = 0;
  for (const name of readdirSync('content/oa-master/editorials').filter((file) => file.endsWith('.json'))) {
    const raw = readFileSync(`content/oa-master/editorials/${name}`, 'utf8');
    // Most files have none: skip the parse.
    if (!/"explanation(Ja|Ko|Vi)"/.test(raw)) continue;
    const id = name.replace(/\.json$/, '');
    const editorial = oaWrittenEditorial(id);
    const local = oaExplanationLocal(editorial);
    if (!editorial?.explanationEn || !local) {
      bad.push(`${id}: a translated editorial needs a valid file with explanationEn`);
      continue;
    }
    for (const [lang, text] of Object.entries(local)) {
      translated++;
      // Code blocks are never translated, so the script rule reads the prose only.
      const problem = scriptProblem(lang, text.replace(/```[\s\S]*?```/g, ''));
      if (problem) bad.push(`${id}: ${problem} ${lang} editorial`);
      if (text.length > 20000) bad.push(`${id}: ${lang} editorial over 20000 chars`);
      assert.deepEqual(fenced(text), fenced(editorial.explanationEn), `${id}: ${lang} code blocks`);
    }
  }
  assert.deepEqual(bad, []);
  assert.ok(translated > 0, 'the Japanese sample (oa-google-25) is read');
  assert.equal(oaExplanationLocal({ id: 'oa-x-1', explanation: '题解' }), undefined);
});
