test.public('the first call runs at once, the next ones wait for the window', () => {
  useFakeTimers();
  const spy = fn();
  const throttled = throttle(spy, 100);
  throttled(1);
  expect(spy.calls).toEqual([[1]]);
  throttled(2);
  advanceTimersByTime(30);
  throttled(3);
  expect(spy.calls).toEqual([[1]]);
});

test.public('the window ends with the last kept call', () => {
  useFakeTimers();
  const spy = fn();
  const throttled = throttle(spy, 100);
  throttled(1);
  advanceTimersByTime(30);
  throttled(2);
  advanceTimersByTime(30);
  throttled(3);
  advanceTimersByTime(40);
  expect(spy.calls).toEqual([[1], [3]]);
});

test('a trailing call opens the next window', () => {
  useFakeTimers();
  const spy = fn();
  const throttled = throttle(spy, 100);
  throttled(1);
  throttled(2);
  advanceTimersByTime(100); // runs 2, new window until 200
  throttled(3);
  advanceTimersByTime(50);
  expect(spy.calls).toEqual([[1], [2]]);
  advanceTimersByTime(50);
  expect(spy.calls).toEqual([[1], [2], [3]]);
});

test('goes idle after an empty window', () => {
  useFakeTimers();
  const spy = fn();
  const throttled = throttle(spy, 100);
  throttled(1);
  advanceTimersByTime(250);
  throttled(2);
  expect(spy.calls).toEqual([[1], [2]]);
});

test('steady calls run once per window, wait ms apart', () => {
  useFakeTimers();
  const start = Date.now();
  const times = [];
  const throttled = throttle(() => times.push(Date.now() - start), 100);
  for (let t = 0; t < 1000; t += 10) {
    throttled(t);
    advanceTimersByTime(10);
  }
  expect(times).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
});

test('keeps this', () => {
  useFakeTimers();
  const spy = fn();
  const a = { go: throttle(spy, 100) };
  a.go();
  a.go();
  advanceTimersByTime(100);
  expect(spy.contexts).toEqual([a, a]);
  expect(spy.contexts[1]).toBe(a);
});

test('cancel drops the kept call', () => {
  useFakeTimers();
  const spy = fn();
  const throttled = throttle(spy, 100);
  throttled(1);
  throttled(2);
  throttled.cancel();
  advanceTimersByTime(300);
  expect(spy.calls).toEqual([[1]]);
  throttled(3);
  expect(spy.calls).toEqual([[1], [3]]);
});
