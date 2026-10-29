import test from 'node:test';
import assert from 'node:assert/strict';
import { PrecompileScheduler } from '../lib/server/oj-precompile-scheduler';
const tick = () => new Promise((resolve) => setImmediate(resolve));
void test('only one background task runs; another program in the foreground leaves it running', async () => {
  const scheduler = new PrecompileScheduler();
  let aborted = false;
  assert.equal(
    scheduler.start('a', async (signal) => {
      await new Promise<void>((resolve) =>
        signal.addEventListener('abort', () => ((aborted = true), resolve()), { once: true }),
      );
    }, 'program-a'),
    true,
  );
  await tick();
  assert.equal(scheduler.start('b', async () => {}), false);
  await scheduler.enterForeground('program-b');
  await scheduler.enterForeground();
  assert.equal(aborted, false, 'the worker cancels it only on case-slot contention');
  await scheduler.cancelBackground();
  assert.equal(aborted, true);
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
void test('foreground of the same program adopts the background compile instead of aborting it', async () => {
  const scheduler = new PrecompileScheduler();
  let finish!: () => void;
  let aborted = false;
  scheduler.start(
    'same',
    async (signal) => {
      signal.addEventListener('abort', () => (aborted = true), { once: true });
      await new Promise<void>((resolve) => (finish = resolve));
    },
    'program-a',
  );
  await tick();
  let entered = false;
  const entering = scheduler.enterForeground('program-a').then(() => {
    entered = true;
  });
  await tick();
  assert.equal(scheduler.isAdopted('same'), true);
  assert.equal(aborted, false, 'the matching compile keeps running');
  assert.equal(entered, false, 'and the foreground waits for it');
  assert.equal(scheduler.canStart, false);
  finish();
  await entering;
  assert.equal(aborted, false);
  assert.equal(scheduler.canStart, true);
  await scheduler.close();
});

void test('an adopted compile survives other foreground work and only close() stops it', async () => {
  const scheduler = new PrecompileScheduler();
  let aborted = false;
  let finish!: () => void;
  scheduler.start(
    'adopted',
    async (signal) => {
      signal.addEventListener('abort', () => (aborted = true), { once: true });
      await new Promise<void>((resolve) => {
        finish = resolve;
        signal.addEventListener('abort', () => resolve(), { once: true });
      });
    },
    'mine',
  );
  await tick();
  const adopting = scheduler.enterForeground('mine');
  await tick();
  // Another learner's submission and the background tick leave it alone.
  await scheduler.enterForeground('theirs');
  await scheduler.cancelBackground();
  assert.equal(aborted, false);
  finish();
  await adopting;
  scheduler.start(
    'adopted-2',
    async (signal) =>
      new Promise<void>((resolve) =>
        signal.addEventListener('abort', () => resolve(), { once: true }),
      ),
    'mine-2',
  );
  await tick();
  void scheduler.enterForeground('mine-2');
  await tick();
  await scheduler.close();
  assert.equal(scheduler.canStart, false);
});

void test('a program a submission is compiling itself reads as in the foreground until released', async () => {
  const scheduler = new PrecompileScheduler();
  const first = await scheduler.enterForeground('program-a');
  const second = await scheduler.enterForeground('program-a');
  await scheduler.enterForeground();
  assert.equal(scheduler.inForeground('program-a'), true);
  assert.equal(scheduler.inForeground('program-b'), false);
  first();
  first();
  assert.equal(scheduler.inForeground('program-a'), true, 'the other submission still compiles it');
  second();
  assert.equal(scheduler.inForeground('program-a'), false);
  await scheduler.close();
});
