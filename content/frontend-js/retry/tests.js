/** A task that fails `failures` times, recording the time of every call. */
function flaky(failures) {
  const start = Date.now();
  const times = [];
  const task = fn(() => {
    times.push(Date.now() - start);
    return times.length <= failures ? Promise.reject(new Error('fail #' + times.length)) : Promise.resolve('ok');
  });
  return { task, times };
}

test.public('a task that works the first time runs once', async () => {
  useFakeTimers();
  const { task } = flaky(0);
  const p = retry(task);
  await advanceTimersByTimeAsync(0);
  await expect(p).resolves.toBe('ok');
  expect(task).toHaveBeenCalledTimes(1);
});

test.public('waits 100, then 200 ms between tries', async () => {
  useFakeTimers();
  const { task, times } = flaky(2);
  const p = retry(task, { retries: 3, delay: 100 });
  await advanceTimersByTimeAsync(1000);
  await expect(p).resolves.toBe('ok');
  expect(times).toEqual([0, 100, 300]);
});

test('does not retry early', async () => {
  useFakeTimers();
  const { task } = flaky(5);
  const p = retry(task, { retries: 2, delay: 50 });
  p.catch(() => {});
  await advanceTimersByTimeAsync(49);
  expect(task).toHaveBeenCalledTimes(1);
  await advanceTimersByTimeAsync(1);
  expect(task).toHaveBeenCalledTimes(2);
});

test('gives up after retries with the last error', async () => {
  useFakeTimers();
  const { task, times } = flaky(10);
  const p = retry(task, { retries: 2, delay: 10, factor: 3 });
  p.catch(() => {});
  await advanceTimersByTimeAsync(1000);
  await expect(p).rejects.toThrow('fail #3');
  expect(times).toEqual([0, 10, 40]);
});

test('retries: 0 means a single try', async () => {
  useFakeTimers();
  const { task } = flaky(1);
  const p = retry(task, { retries: 0 });
  p.catch(() => {});
  await advanceTimersByTimeAsync(1000);
  await expect(p).rejects.toThrow('fail #1');
  expect(task).toHaveBeenCalledTimes(1);
});

test('the defaults are 3 retries from 100 ms, doubling', async () => {
  useFakeTimers();
  const { task, times } = flaky(10);
  const p = retry(task);
  p.catch(() => {});
  await advanceTimersByTimeAsync(5000);
  await expect(p).rejects.toThrow('fail #4');
  expect(times).toEqual([0, 100, 300, 700]);
});
