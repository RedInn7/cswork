import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  matchesSemantic,
  SEMANTIC_IDS,
  type SemanticId,
} from '../lib/oj-semantic-checkers';
const fixture = JSON.parse(
  readFileSync(
    new URL('../fixtures/oj-semantic-checkers.json', import.meta.url),
    'utf8',
  ),
) as {
  cases: {
    name: string;
    id: number;
    actual: string;
    expected: string;
    input: string;
    accepted: boolean;
  }[];
};
for (const c of fixture.cases) {
  void test(c.name, () => {
    assert.equal(
      matchesSemantic(c.id as SemanticId, c.actual, c.expected, c.input),
      c.accepted,
    );
  });
}
void test('all fixed semantic IDs have both valid and rejected shared examples', () => {
  for (const id of SEMANTIC_IDS) {
    assert.ok(fixture.cases.some((c) => c.id === id && c.accepted));
    assert.ok(fixture.cases.some((c) => c.id === id && !c.accepted));
  }
});
