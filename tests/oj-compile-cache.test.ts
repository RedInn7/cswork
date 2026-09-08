import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CompiledProgramCache } from '../lib/server/oj-compile-cache';
import type { compile } from '../lib/server/oj-engine';

void test('default cache retains a ten-learner run-to-submit burst without recompiling', async () => {
  let calls = 0;
  const compiler: typeof compile = async (language, source) => ({
    result: { status: 'Accepted' },
    program: { language, source, cache: { main: String(++calls) } },
  });
  const cache = new CompiledProgramCache(compiler, async () => {});
  try {
    for (let round = 0; round < 2; round++) {
      for (let learner = 0; learner < 10; learner++) {
        const acquired = await cache.acquire(
          `learner-${learner}`, 'cpp', 'same reviewed solution', new AbortController().signal,
        );
        if (round) assert.equal(acquired.cacheHit, true);
        await acquired.release();
      }
    }
    assert.equal(calls, 10, 'all ten isolated owners should compile only once');
  } finally {
    await cache.close();
  }
});

void test('default cache still evicts beyond sixteen entries and cleans every artifact', async () => {
  let calls = 0;
  const removed: string[] = [];
  const cache = new CompiledProgramCache(async (language, source) => ({
    result: { status: 'Accepted' },
    program: { language, source, cache: { main: String(++calls) } },
  }), async (program) => { removed.push(program.cache.main); });
  for (let i = 0; i < 17; i++) {
    const item = await cache.acquire(`learner-${i}`, 'cpp', 'source', new AbortController().signal);
    await item.release();
  }
  assert.deepEqual(removed, ['1']);
  const last = await cache.acquire('learner-16', 'cpp', 'source', new AbortController().signal);
  assert.equal(last.cacheHit, true);
  await last.release();
  await cache.close();
  assert.equal(new Set(removed).size, 17);
  assert.equal(removed.length, 17);
});

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
void test('run then submit unchanged code reuses compilation, but per-submission flags stay independent', async () => {
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
void test('changed code, driver, language or owner must compile independently', async () => {
  const f = fixture(8);
  for (const [owner, source] of [
    ['alice', 'one'],
    ['alice', 'two'],
    ['bob', 'one'],
  ]) {
    const p = await f.get(owner, source);
    await p.release();
  }
  const java = await f.cache.acquire(
    'alice',
    'java',
    'one',
    new AbortController().signal,
  );
  await java.release();
  assert.equal(f.calls(), 4);
  await f.cache.close();
});
void test('failures and expired or evicted binaries do not survive; active leases are not evicted', async () => {
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
void test('overlapping identical misses never orphan a compiled binary', async () => {
  const f = fixture(2);
  const [first, second] = await Promise.all([f.get(), f.get()]);
  await first.release();
  await second.release();
  await f.cache.close();
  assert.equal(f.calls(), 2);
  assert.equal(f.removed.length, 2);
  assert.equal(new Set(f.removed).size, 2);
});
void test('warming uses exact owner/source key and foreground acquisition promotes the entry', async () => {
  const f = fixture(3),
    signal = new AbortController().signal;
  assert.equal(await f.cache.warm('alice', 'cpp', 'warm', signal), 'warmed');
  assert.equal(await f.cache.warm('alice', 'cpp', 'warm', signal), 'cached');
  const acquired = await f.get('alice', 'warm');
  assert.equal(acquired.cacheHit, true);
  await acquired.release();
  await f.cache.warm('bob', 'cpp', 'one', signal);
  await f.cache.warm('bob', 'cpp', 'two', signal);
  await f.cache.warm('bob', 'cpp', 'three', signal);
  const again = await f.get('alice', 'warm');
  assert.equal(again.cacheHit, true);
  await again.release();
  assert.equal(f.calls(), 4);
  await f.cache.close();
});
void test('eight full foreground slots retain their binaries while two independent warm slots rotate', async () => {
  const f = fixture(8),
    signal = new AbortController().signal;
  for (let i = 0; i < 8; i++) {
    const p = await f.get('alice', `formal-${i}`);
    await p.release();
  }
  for (const source of ['warm-a', 'warm-b'])
    assert.equal(await f.cache.warm('alice', 'cpp', source, signal), 'warmed');
  assert.deepEqual(f.removed, []);
  assert.equal(f.calls(), 10);
  assert.equal(await f.cache.warm('alice', 'cpp', 'warm-c', signal), 'warmed');
  assert.deepEqual(f.removed, ['9']);
  for (let i = 0; i < 8; i++) {
    const p = await f.get('alice', `formal-${i}`);
    assert.equal(p.cacheHit, true);
    await p.release();
  }
  const promoted = await f.get('alice', 'warm-c');
  assert.equal(promoted.cacheHit, true);
  await promoted.release();
  assert.deepEqual(f.removed, ['9', '1']);
  const another = await f.get('alice', 'formal-extra');
  await another.release();
  assert.deepEqual(f.removed, ['9', '1', '2']);
  assert.equal(await f.cache.warm('alice', 'cpp', 'warm-b', signal), 'cached');
  await f.cache.close();
  assert.equal(new Set(f.removed).size, f.calls());
});
void test('promotion never evicts leased foreground binaries and disabled caches skip warming', async () => {
  const f = fixture(1),
    signal = new AbortController().signal;
  const held = await f.get('alice', 'held');
  await f.cache.warm('alice', 'cpp', 'warm', signal);
  const warm = await f.get('alice', 'warm');
  assert.equal(warm.cacheHit, true);
  assert.deepEqual(f.removed, []);
  await warm.release();
  assert.deepEqual(f.removed, ['2']);
  await held.release();
  const again = await f.get('alice', 'held');
  assert.equal(again.cacheHit, true);
  await again.release();
  await f.cache.close();
  const disabled = fixture(0);
  assert.equal(
    await disabled.cache.warm('alice', 'cpp', 'source', signal),
    'skipped',
  );
  assert.equal(disabled.calls(), 0);
  await disabled.cache.close();
});
void test('aborted warm results are disposed even when compiler resolves after cancellation', async () => {
  let finish!: () => void;
  const removed: string[] = [];
  const cache = new CompiledProgramCache(
    async (language, source) => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      return {
        result: { status: 'Accepted' },
        program: { language, source, cache: { main: 'late' } },
      };
    },
    async (program) => {
      removed.push(program.cache.main);
    },
  );
  const controller = new AbortController();
  const pending = cache.warm('alice', 'cpp', 'source', controller.signal);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    await cache.warm('bob', 'cpp', 'other', new AbortController().signal),
    'skipped',
  );
  controller.abort();
  finish();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.deepEqual(removed, ['late']);
  await cache.close();
});
void test('warm errors do not remain cached and closing during compilation disposes the result', async () => {
  const f = fixture(2),
    signal = new AbortController().signal;
  assert.equal(await f.cache.warm('alice', 'cpp', 'bad', signal), 'failed');
  assert.deepEqual(f.removed, ['1']);
  await f.cache.close();
  assert.equal(await f.cache.warm('alice', 'cpp', 'late', signal), 'skipped');
  assert.equal(f.calls(), 1);
  let finish!: () => void,
    disposed = 0;
  const cache = new CompiledProgramCache(
    async (language, source) => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      return {
        result: { status: 'Accepted' },
        program: { language, source, cache: { main: 'late' } },
      };
    },
    async () => {
      disposed++;
    },
  );
  const pending = cache.warm('alice', 'cpp', 'source', signal);
  await new Promise((resolve) => setImmediate(resolve));
  await cache.close();
  finish();
  assert.equal(await pending, 'skipped');
  assert.equal(disposed, 1);
});
