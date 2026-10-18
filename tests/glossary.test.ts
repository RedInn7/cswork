import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GLOSSARY, GLOSSARY_GROUPS, glossaryHits } from '../lib/glossary';
import { STOP_NAMES } from '../lib/route-stops';

const CJK = /[㐀-鿿＀-￯]/;

void test('the glossary has enough unique, well-formed terms in both languages', () => {
  assert.ok(GLOSSARY.length >= 140, `${GLOSSARY.length} terms`);
  assert.equal(new Set(GLOSSARY.map((t) => t.id)).size, GLOSSARY.length, 'unique ids');
  const groups = new Set(GLOSSARY_GROUPS.map(([g]) => g));
  for (const t of GLOSSARY) {
    assert.match(t.id, /^[a-z0-9-]+$/, t.id);
    assert.ok(CJK.test(t.zh), `${t.id} zh`);
    for (const text of [t.en, t.say, ...(t.alt ?? [])]) assert.ok(text && !CJK.test(text), `${t.id}: ${text}`);
    const say = t.say.toLowerCase();
    assert.ok([t.en, ...(t.alt ?? [])].some((n) => say.includes(n.toLowerCase())), `${t.id} says its name`);
    assert.ok(t.stop === undefined || Object.hasOwn(STOP_NAMES, t.stop), `${t.id} stop ${t.stop}`);
    assert.ok(groups.has(t.group), `${t.id} group`);
  }
  // Every group has terms.
  for (const g of groups) assert.ok(GLOSSARY.some((t) => t.group === g), g);
});

void test('search: Chinese, English and alternative names, prefix matches first', () => {
  assert.equal(glossaryHits('差分')[0].id, 'difference-array');
  assert.ok(glossaryHits('bit').some((t) => t.id === 'fenwick-tree'), 'BIT is a Fenwick tree');
  assert.equal(glossaryHits('  ').length, 0);
  assert.equal(glossaryHits('Union-Find')[0].id, 'union-find');
  const heap = glossaryHits('heap');
  assert.equal(heap[0].id, 'heap', 'a prefix match ranks above min-heap inside another name');
  assert.equal(glossaryHits('换根')[0].id, 'rerooting');
  assert.equal(glossaryHits('状压')[0].id, 'bitmask-dp');
});
