import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeLiteBoot, type Boot } from '../lib/types';

const boot = (personId: string | null, problems: string[]) =>
  ({
    person: personId ? { id: personId } : null,
    problems: problems.map((id) => ({ id })),
    courses: [],
  }) as unknown as Boot;

void test('a lite refresh keeps the catalogue and takes everything else', () => {
  const prev = boot('u1', ['lc-1', 'oa-amazon-1']);
  const next = { ...boot('u1', []), problems: undefined, courses: [{ id: 'new' }] } as unknown as Boot;
  const merged = mergeLiteBoot(prev, next)!;
  assert.equal(merged.problems, prev.problems);
  assert.deepEqual(merged.courses, [{ id: 'new' }]);
});

void test('a different person (sign-out, other account) needs a full bootstrap', () => {
  assert.equal(mergeLiteBoot(boot('u1', ['lc-1']), boot(null, [])), null);
  assert.equal(mergeLiteBoot(boot('u1', ['lc-1']), boot('u2', [])), null);
});
