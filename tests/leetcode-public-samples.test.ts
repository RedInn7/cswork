import { test } from 'node:test';
import assert from 'node:assert/strict';
import samples from '../lib/content/leetcode-public-samples.json';
import { leetcodePublicSample } from '../lib/leetcode-public-samples';
const all = samples as Record<
  string,
  {
    sourceInput: string;
    sourceOutput: string;
    input?: string;
    output?: string;
  }[]
>;
const read = (id: string) => {
  const s = all[id][0];
  return leetcodePublicSample(id, {
    input: s.sourceInput,
    expectedOutput: s.sourceOutput,
  })!;
};
test('500 selected problems have public snapshots, normal arrays and trees are named arguments', () => {
  assert.equal(Object.keys(all).length, 500);
  assert.equal(read('lc-1').input, 'nums = [2,7,11,15]\ntarget = 9');
  assert.equal(read('lc-1').output, '[0,1]');
  assert.equal(read('lc-104').input, 'root = [3,9,20,null,null,15,7]');
  assert.equal(read('lc-200').input, 'grid = [["0"]]');
});
test('design operations retain null outputs and align one result per call', () => {
  const s = read('lc-146');
  const ops = JSON.parse(s.input!.split('\n')[0].slice('operations = '.length));
  const values = JSON.parse(s.output!);
  assert.equal(ops.length, values.length);
  assert.equal(values[0], null);
  assert.equal(values[1], null);
  assert.equal(values[3], 1);
});
test('changed input or output cannot receive a stale display; special node protocols stay honest', () => {
  const s = all['lc-1'][0];
  assert.equal(
    leetcodePublicSample('lc-1', {
      input: s.sourceInput + ' ',
      expectedOutput: s.sourceOutput,
    }),
    undefined,
  );
  assert.equal(
    leetcodePublicSample('lc-1', {
      input: s.sourceInput,
      expectedOutput: 'wrong',
    }),
    undefined,
  );
  assert.equal(read('lc-160').input, undefined);
});

test('in-place adapters show named modified values, prefix adapters also show their integer return', () => {
  assert.equal(read('lc-26').output, '返回值 k = 2\nnums[0:k] = [1,2]');
  assert.equal(read('lc-26').outputEn, 'Return value k = 2\nnums[0:k] = [1,2]');
  assert.equal(read('lc-27').output, '返回值 k = 2\nnums[0:k] = [2,2]');
  assert.equal(read('lc-80').output, '返回值 k = 5\nnums[0:k] = [1,1,2,2,3]');
  assert.equal(read('lc-48').output, 'matrix = [[3,1],[4,2]]');
  assert.equal(read('lc-344').output, 's = ["o","l","l","e","h"]');
  assert.equal(read('lc-88').output, 'nums1 = [1,2,2,3,5,6]');
  assert.equal(
    read('lc-114').output,
    'root = [1,null,2,null,3,null,4,null,5,null,6]',
  );
  assert.equal(read('lc-143').output, 'head = [1,4,2,3]');
  for (const id of [
    'lc-26',
    'lc-27',
    'lc-80',
    'lc-48',
    'lc-344',
    'lc-88',
    'lc-114',
    'lc-143',
  ]) {
    assert.equal(read(id).mutated, true);
  }
});

test('return normalization adapters restore booleans and rows without claiming mutation', () => {
  assert.deepEqual(JSON.parse(read('lc-1023').output!), [
    true,
    false,
    true,
    true,
    false,
  ]);
  assert.deepEqual(JSON.parse(read('lc-1462').output!), [false, true]);
  assert.deepEqual(JSON.parse(read('lc-417').output!), [
    [0, 4],
    [1, 3],
    [1, 4],
    [2, 2],
    [3, 0],
    [3, 1],
    [4, 0],
  ]);
  for (const id of ['lc-1023', 'lc-1462', 'lc-417', 'lc-1']) {
    assert.equal(read(id).mutated, false);
  }
});
