import test from 'node:test';
import assert from 'node:assert/strict';
import {
  orderedCaseResults,
  caseConcurrency,
} from '../lib/server/oj-case-stream';
const turn = () => new Promise((resolve) => setImmediate(resolve));
test('early failure aborts active neighbour without launching later cases', async () => {
  const controller = new AbortController();
  const started: number[] = [];
  for await (const _ of orderedCaseResults(
    [0, 1, 2],
    async (n) => {
      started.push(n);
      if (n === 1)
        await new Promise<void>((resolve) => {
          controller.signal.addEventListener('abort', () => resolve(), {
            once: true,
          });
          setTimeout(resolve, 100);
        });
      return n;
    },
    2,
    () => controller.abort(),
  ))
    break;
  assert.equal(controller.signal.aborted, true);
  assert.deepEqual(started, [0, 1]);
});
test('two cases run concurrently, results remain in order, all cases execute', async () => {
  const release = new Map<number, (value: number) => void>();
  const started: number[] = [],
    seen: number[] = [];
  const work = (async () => {
    for await (const { item, result } of orderedCaseResults(
      [0, 1, 2, 3],
      (n) => {
        started.push(n);
        return new Promise<number>((resolve) => release.set(n, resolve));
      },
      2,
    )) {
      assert.equal(item, result);
      seen.push(result);
    }
  })();
  await turn();
  assert.deepEqual(started, [0, 1]);
  release.get(1)!(1);
  await turn();
  assert.deepEqual(seen, []);
  release.get(0)!(0);
  await turn();
  assert.deepEqual(seen, [0, 1]);
  assert.deepEqual(started, [0, 1, 2, 3]);
  release.get(3)!(3);
  release.get(2)!(2);
  await work;
  assert.deepEqual(seen, [0, 1, 2, 3]);
});
test('early stop drains only the active neighbour before releasing resources', async () => {
  let neighbourDone!: () => void,
    finished = false;
  const started: number[] = [];
  const work = (async () => {
    for await (const _ of orderedCaseResults(
      [0, 1, 2],
      async (n) => {
        started.push(n);
        if (n === 1)
          await new Promise<void>((resolve) => (neighbourDone = resolve));
        return n;
      },
      2,
    ))
      break;
    finished = true;
  })();
  await turn();
  assert.deepEqual(started, [0, 1]);
  assert.equal(finished, false);
  neighbourDone();
  await work;
  assert.equal(finished, true);
  assert.deepEqual(started, [0, 1]);
});
test('rejected later case is handled immediately and propagated in case order', async () => {
  const seen: number[] = [];
  await assert.rejects(async () => {
    for await (const { result } of orderedCaseResults(
      [0, 1],
      async (n) => {
        if (n === 1) throw new Error('engine failed');
        await turn();
        return n;
      },
      2,
    ))
      seen.push(result);
  }, /engine failed/);
  assert.deepEqual(seen, [0]);
});
test('large-memory problems stay serial and zero cases stay empty', async () => {
  assert.equal(caseConcurrency(256 * 1024), 2);
  assert.equal(caseConcurrency(512 * 1024 + 1), 1);
  let active = 0;
  for await (const _ of orderedCaseResults(
    [1, 2],
    async (n) => {
      assert.equal(active++, 0);
      await turn();
      active--;
      return n;
    },
    1,
  )) {
  }
  for await (const _ of orderedCaseResults(
    [],
    async () => {
      throw new Error('unreachable');
    },
    2,
  ))
    assert.fail();
});
