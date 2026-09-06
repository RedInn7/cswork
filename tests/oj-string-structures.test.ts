import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  matchesStringStructure,
  STRING_STRUCTURE_IDS,
} from '../lib/oj-string-structures';
const fixture = JSON.parse(
  readFileSync(
    new URL('../fixtures/oj-string-structures.json', import.meta.url),
    'utf8',
  ),
) as {
  cases: {
    id: number;
    name: string;
    actual: string;
    expected: string;
    accepted: boolean;
  }[];
};
for (const c of fixture.cases)
  void test(c.name, () =>
    assert.equal(
      matchesStringStructure(c.id, c.actual, c.expected),
      c.accepted,
    ),
  );
void test('all fixed IDs have valid and invalid examples', () => {
  for (const id of STRING_STRUCTURE_IDS)
    for (const accepted of [true, false])
      assert.ok(
        fixture.cases.some((c) => c.id === id && c.accepted === accepted),
      );
});
