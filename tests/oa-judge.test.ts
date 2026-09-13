import assert from 'node:assert/strict';
import test from 'node:test';
import { createOaJudgeRegistry } from '../lib/server/oa-judge';

const source = 'a'.repeat(64);
const checksum = 'b'.repeat(64);
const item = {
  id: 'oa-fixture-1',
  sourceContentHash: source,
  packageChecksum: checksum,
  editorial: '自编题解',
  authoredSolutions: [{ language: 'python', code: 'print(1)' }],
};
const make = (hash = source) =>
  createOaJudgeRegistry(
    { schemaVersion: 1, items: [item] },
    new Map([[item.id, hash]]),
  );
const version = {
  id: item.id,
  checksum,
  spec_json: JSON.stringify({ id: item.id }),
};

test('OA readiness requires exact source, package checksum and spec identity', () => {
  assert.equal(make().isReady(version), true);
  assert.equal(make('c'.repeat(64)).isReady(version), false);
  assert.equal(make().isReady({ ...version, checksum: 'c'.repeat(64) }), false);
  assert.equal(make().isReady({ ...version, id: 'oa-unknown-1' }), false);
  assert.equal(make().isReady({ ...version, spec_json: '{}' }), false);
  assert.equal(make().isReady({ ...version, spec_json: '{' }), false);
  assert.equal(
    make().isReady({
      ...version,
      spec_json: JSON.stringify({ id: 'different' }),
    }),
    false,
  );
});
test('only authored current-source editorial is exposed', () => {
  assert.deepEqual(make().solution(item.id), {
    explanation: item.editorial,
    solutions: item.authoredSolutions,
  });
  assert.throws(() => make('c'.repeat(64)).solution(item.id), { status: 409 });
  assert.throws(() => make().solution('oa-missing-1'), { status: 409 });
  assert.throws(() => make().solution(item.id, 'c'.repeat(64)), {
    status: 409,
  });
});
test('registry rejects duplicate identity and malformed verification digest', () => {
  assert.throws(() =>
    createOaJudgeRegistry({ schemaVersion: 1, items: [item, item] }, new Map()),
  );
  assert.throws(() =>
    createOaJudgeRegistry(
      { schemaVersion: 1, items: [{ ...item, packageChecksum: 'invalid' }] },
      new Map(),
    ),
  );
  assert.equal(
    createOaJudgeRegistry({ schemaVersion: 1, items: [] }, new Map()).isReady(
      version,
    ),
    false,
  );
});
