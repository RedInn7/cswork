// lib/content/topic-why.json: every Line 500 stop's correctness points, 30-second script and Core Skills.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import why from '../lib/content/topic-why.json';
import coreSkills from '../lib/content/core-skills.json';
import { ROUTE_SLUGS } from '../lib/route-stops';

type Entry = { why: { zh: string; en: string }[]; say: { zh: string; en: string }; core: string[] };
const entries = why as Record<string, Entry>;
const CJK = /[一-鿿]/;

test('every stop, in line order, has 2–3 bilingual points and a script of 3–4 English sentences', () => {
  assert.deepEqual(Object.keys(entries), ROUTE_SLUGS);
  for (const [slug, { why: points, say }] of Object.entries(entries)) {
    assert.ok(points.length >= 2 && points.length <= 3, slug);
    for (const text of [...points, say]) {
      assert.ok(CJK.test(text.zh), `${slug}: zh is Chinese`);
      assert.ok(text.en.length > 40 && !CJK.test(text.en), `${slug}: en is English`);
    }
    const sentences = say.en.match(/[.!?](?=\s|$)/g)?.length ?? 0;
    assert.ok(sentences >= 3 && sentences <= 4, `${slug}: ${sentences} sentences`);
  }
});

test('the 21 algorithmic Core Skills problems each hang on exactly one stop; concurrency and OOD on none', () => {
  const ids = new Set(coreSkills.problems.map((p) => p.id));
  const hung = Object.values(entries).flatMap((e) => e.core);
  assert.ok(hung.every((id) => ids.has(id)), 'known Core Skills ids');
  const algorithmic = coreSkills.groups.filter((g) => g.key !== 'concurrency' && g.key !== 'ood').flatMap((g) => g.ids);
  assert.equal(algorithmic.length, 21);
  assert.deepEqual([...hung].sort(), [...algorithmic].sort());
});
