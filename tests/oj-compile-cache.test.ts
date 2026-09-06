import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CompiledProgramCache } from '../lib/server/oj-compile-cache';
import type { compile } from '../lib/server/oj-engine';

function fixture(capacity = 2) {
  let clock = 0,
    calls = 0;
  const removed: string[] = [];
  const compiler: typeof compile = async (language, source) => {
    calls++;
    return {
      result: { status: source === 'bad' ? 'Compile Error' : 'Accepted' },
      program: { language, source, cache: { main: String(calls) } },
    };
  };
  const cache = new CompiledProgramCache(
    compiler,
    async (p) => {
      removed.push(p.cache.main);
    },
    capacity,
    100,
    () => clock,
  );
  const get = (owner = 'alice', source = 'source') =>
    cache.acquire(owner, 'cpp', source, new AbortController().signal);
  return {
    cache,
    get,
    removed,
    calls: () => calls,
    tick: () => {
      clock += 101;
    },
  };
}
test('run then submit unchanged code reuses compilation, but per-submission flags stay independent', async () => {
  const f = fixture();
  const sample = await f.get();
  sample.program.bridgeSource = 'bridge';
  sample.program.leetcodeInput = true;
  await sample.release();
  const submission = await f.get();
  assert.equal(f.calls(), 1);
  assert.equal(submission.cacheHit, true);
  assert.equal(submission.program.bridgeSource, undefined);
  assert.equal(submission.program.leetcodeInput, undefined);
  await submission.release();
  await f.cache.close();
  assert.deepEqual(f.removed, ['1']);
});
test('changed code, driver, language or owner must compile independently', async () => {
  const f = fixture(8);
  for (const [owner, source] of [
    ['alice', 'one'],
    ['alice', 'two'],
    ['bob', 'one'],
  ]) {
    const p = await f.get(owner, source);
    await p.release();
  }
  const java = await f.cache.acquire('alice', 'java', 'one', new AbortController().signal);
  await java.release();
  assert.equal(f.calls(), 4);
  await f.cache.close();
});
test('failures and expired or evicted binaries do not survive; active leases are not evicted', async () => {
  const f = fixture(1);
  const first = await f.get();
  const other = await f.get('bob');
  await other.release();
  assert.deepEqual(f.removed, ['2']);
  await first.release();
  f.tick();
  await f.cache.prune();
  assert.deepEqual(f.removed, ['2', '1']);
  for (let i = 0; i < 2; i++) {
    const bad = await f.get('alice', 'bad');
    await bad.release();
  }
  assert.equal(f.calls(), 4);
  const valid = await f.get();
  await valid.release(true);
  await valid.release(true);
  const retry = await f.get();
  assert.equal(retry.cacheHit, false);
  await retry.release();
  await f.cache.close();
  assert.equal(new Set(f.removed).size, f.removed.length);
});
test('overlapping identical misses never orphan a compiled binary', async () => {
  const f = fixture(2);
  const [first, second] = await Promise.all([f.get(), f.get()]);
  await first.release();
  await second.release();
  await f.cache.close();
  assert.equal(f.calls(), 2);
  assert.equal(f.removed.length, 2);
  assert.equal(new Set(f.removed).size, 2);
});
