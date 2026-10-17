/** A task that records when it starts and ends, and how many tasks run at once. */
function tracker() {
  const log = { starts: [], peak: 0, running: 0 };
  const start = Date.now();
  log.task = (value, ms, fail) => () => {
    log.starts.push(Date.now() - start);
    log.running += 1;
    log.peak = Math.max(log.peak, log.running);
    return new Promise((resolve, reject) =>
      setTimeout(() => {
        log.running -= 1;
        if (fail) reject(new Error(value));
        else resolve(value);
      }, ms),
    );
  };
  return log;
}

test.public('results come back in task order', async () => {
  useFakeTimers();
  const log = tracker();
  const p = promisePool([log.task('a', 30), log.task('b', 10), log.task('c', 10)], 2);
  await advanceTimersByTimeAsync(100);
  await expect(p).resolves.toEqual(['a', 'b', 'c']);
});

test.public('never runs more than limit at once', async () => {
  useFakeTimers();
  const log = tracker();
  const tasks = [10, 50, 20, 20, 5, 30, 10].map((ms, i) => log.task(i, ms));
  const p = promisePool(tasks, 3);
  await advanceTimersByTimeAsync(500);
  await p;
  expect(log.peak).toBe(3);
});

test('starts the next task as soon as one finishes', async () => {
  useFakeTimers();
  const log = tracker();
  const p = promisePool([log.task('a', 30), log.task('b', 10), log.task('c', 10), log.task('d', 10)], 2);
  await advanceTimersByTimeAsync(100);
  await p;
  expect(log.starts).toEqual([0, 0, 10, 20]);
});

test('an empty list gives []', async () => {
  await expect(promisePool([], 2)).resolves.toEqual([]);
});

test('a limit above the task count runs everything at once', async () => {
  useFakeTimers();
  const log = tracker();
  const p = promisePool([log.task(1, 10), log.task(2, 10)], 10);
  await advanceTimersByTimeAsync(10);
  await expect(p).resolves.toEqual([1, 2]);
  expect(log.starts).toEqual([0, 0]);
});

test('a failure rejects the pool and starts nothing new', async () => {
  useFakeTimers();
  const log = tracker();
  const p = promisePool([log.task('boom', 10, true), log.task('b', 50), log.task('c', 10)], 2);
  p.catch(() => {});
  await advanceTimersByTimeAsync(200);
  await expect(p).rejects.toThrow('boom');
  expect(log.starts).toEqual([0, 0]);
});

test('a task that throws synchronously rejects the pool', async () => {
  const p = promisePool(
    [
      () => {
        throw new Error('sync');
      },
    ],
    1,
  );
  await expect(p).rejects.toThrow('sync');
});
