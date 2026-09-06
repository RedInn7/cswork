import test from 'node:test';
import assert from 'node:assert/strict';
import { PrecompileScheduler } from '../lib/server/oj-precompile-scheduler';
const tick = () => new Promise((resolve) => setImmediate(resolve));
void test('only one background task runs, foreground reserves immediately and awaits cleanup', async () => {
  const scheduler = new PrecompileScheduler();
  let cleanup!: () => void;
  let stopped = false;
  assert.equal(
    scheduler.start('a', async (signal) => {
      await new Promise<void>((resolve) =>
        signal.addEventListener(
          'abort',
          () => {
            stopped = true;
            cleanup = resolve;
          },
          { once: true },
        ),
      );
    }),
    true,
  );
  await tick();
  assert.equal(
    scheduler.start('b', async () => {}),
    false,
  );
  let acquired = false;
  const entering = scheduler.enterForeground().then((release) => {
    acquired = true;
    return release;
  });
  assert.equal(stopped, true);
  assert.equal(
    scheduler.start('b', async () => {}),
    false,
  );
  await tick();
  assert.equal(acquired, false);
  cleanup();
  const release = await entering;
  assert.equal(scheduler.canStart, false);
  release();
  release();
  assert.equal(scheduler.canStart, true);
  await scheduler.close();
});
void test('background failure is contained, cancellation is identity-scoped, close prevents restart', async () => {
  const scheduler = new PrecompileScheduler();
  scheduler.start('failure', async () => {
    throw Error('compile failed');
  });
  await tick();
  assert.equal(scheduler.canStart, true);
  let aborted = false;
  scheduler.start('active', async (signal) => {
    await new Promise<void>((resolve) =>
      signal.addEventListener(
        'abort',
        () => {
          aborted = true;
          resolve();
        },
        { once: true },
      ),
    );
  });
  await tick();
  await scheduler.cancelBackground('different');
  assert.equal(aborted, false);
  await scheduler.close();
  assert.equal(aborted, true);
  assert.equal(
    scheduler.start('late', async () => {}),
    false,
  );
});
void test('overlapping foreground reservations prevent background until all release', async () => {
  const scheduler = new PrecompileScheduler();
  const first = await scheduler.enterForeground(),
    second = await scheduler.enterForeground();
  first();
  assert.equal(scheduler.canStart, false);
  second();
  assert.equal(scheduler.canStart, true);
  await scheduler.close();
});
