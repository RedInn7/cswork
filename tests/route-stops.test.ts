import assert from 'node:assert/strict';
import { test } from 'node:test';
import { curatedSections } from '../lib/ling-curated';
import { ROUTE_SLUGS, STOP_NAMES, STOP_PREREQS, routeLayers, stopPrereqs } from '../lib/route-stops';

void test('the line order is the curated order, and every stop has prerequisites listed', () => {
  assert.deepEqual(ROUTE_SLUGS, curatedSections.map((s) => s.slug));
  assert.deepEqual(Object.keys(STOP_PREREQS).sort(), ROUTE_SLUGS.toSorted());
  assert.deepEqual(Object.keys(STOP_NAMES).sort(), ROUTE_SLUGS.toSorted());
  assert.deepEqual(stopPrereqs('nope'), []);
  assert.deepEqual(stopPrereqs('toString'), []);
});

void test('prerequisites form a DAG that points back along the line and reaches every stop', () => {
  for (const [slug, prereqs] of Object.entries(STOP_PREREQS))
    for (const p of prereqs) {
      assert.ok(ROUTE_SLUGS.includes(p), `${slug} ← ${p} is a stop`);
      // An edge back along the line also rules out cycles.
      assert.ok(ROUTE_SLUGS.indexOf(p) < ROUTE_SLUGS.indexOf(slug), `${p} comes before ${slug}`);
    }
  const roots = ROUTE_SLUGS.filter((slug) => !STOP_PREREQS[slug].length);
  assert.deepEqual(roots, ['array-foundations']);
  // Walk forward from the root: every stop is reachable.
  const seen = new Set(roots);
  for (let grew = true; grew; ) {
    grew = false;
    for (const slug of ROUTE_SLUGS)
      if (!seen.has(slug) && STOP_PREREQS[slug].some((p) => seen.has(p))) {
        seen.add(slug);
        grew = true;
      }
  }
  assert.equal(seen.size, ROUTE_SLUGS.length);
});

void test('layers follow the longest prerequisite path', () => {
  const layers = routeLayers();
  assert.deepEqual(layers.flat().toSorted(), ROUTE_SLUGS.toSorted(), 'each stop once');
  assert.deepEqual(layers[0], ['array-foundations']);
  const column = new Map(layers.flatMap((layer, i) => layer.map((slug) => [slug, i] as const)));
  for (const slug of ROUTE_SLUGS) {
    const prereqs = STOP_PREREQS[slug];
    if (!prereqs.length) continue;
    assert.equal(column.get(slug), Math.max(...prereqs.map((p) => column.get(p)!)) + 1, slug);
  }
  assert.equal(column.get('dp-palindrome'), layers.length - 1, 'the deepest chain ends last');
});
