test.public('returns a promise', () => {
  useFakeTimers();
  expect(sleep(10)).toBeInstanceOf(Promise);
});

test.public('fulfills after ms, not before', async () => {
  useFakeTimers();
  let done = false;
  sleep(200).then(() => (done = true));
  await advanceTimersByTimeAsync(199);
  expect(done).toBe(false);
  await advanceTimersByTimeAsync(1);
  expect(done).toBe(true);
});

test('fulfills with undefined', async () => {
  useFakeTimers();
  const p = sleep(5);
  await advanceTimersByTimeAsync(5);
  await expect(p).resolves.toBeUndefined();
});

test('sleeps run side by side', async () => {
  useFakeTimers();
  const order = [];
  sleep(300).then(() => order.push(300));
  sleep(100).then(() => order.push(100));
  sleep(200).then(() => order.push(200));
  await advanceTimersByTimeAsync(300);
  expect(order).toEqual([100, 200, 300]);
});

test('sleep(0) still waits for a timer', async () => {
  useFakeTimers();
  let done = false;
  sleep(0).then(() => (done = true));
  await flushPromises();
  expect(done).toBe(false);
  await advanceTimersByTimeAsync(0);
  expect(done).toBe(true);
});
