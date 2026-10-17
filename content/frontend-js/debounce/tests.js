test.public('runs once, with the last arguments, wait ms after the last call', () => {
  useFakeTimers();
  const spy = fn();
  const debounced = debounce(spy, 100);
  debounced('a');
  advanceTimersByTime(50);
  debounced('b');
  advanceTimersByTime(50);
  debounced('c');
  advanceTimersByTime(99);
  expect(spy).toHaveBeenCalledTimes(0);
  advanceTimersByTime(1);
  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy).toHaveBeenCalledWith('c');
});

test.public('a quiet gap longer than wait starts a new burst', () => {
  useFakeTimers();
  const spy = fn();
  const debounced = debounce(spy, 100);
  debounced(1);
  advanceTimersByTime(150);
  debounced(2);
  advanceTimersByTime(150);
  expect(spy.calls).toEqual([[1], [2]]);
});

test('keeps this and every argument', () => {
  useFakeTimers();
  const spy = fn();
  const obj = { run: debounce(spy, 50) };
  obj.run(1, 2, 3);
  advanceTimersByTime(50);
  expect(spy.calls).toEqual([[1, 2, 3]]);
  expect(spy.contexts[0]).toBe(obj);
});

test('leading: runs at once, ignores the rest of the burst', () => {
  useFakeTimers();
  const spy = fn();
  const debounced = debounce(spy, 100, { leading: true, trailing: false });
  debounced('a');
  expect(spy.calls).toEqual([['a']]);
  debounced('b');
  advanceTimersByTime(60);
  debounced('c');
  advanceTimersByTime(200);
  expect(spy.calls).toEqual([['a']]);
  debounced('d');
  expect(spy.calls).toEqual([['a'], ['d']]);
});

test('leading and trailing: one call runs once', () => {
  useFakeTimers();
  const spy = fn();
  const debounced = debounce(spy, 100, { leading: true, trailing: true });
  debounced('only');
  advanceTimersByTime(500);
  expect(spy.calls).toEqual([['only']]);
});

test('leading and trailing: a burst runs at both edges', () => {
  useFakeTimers();
  const spy = fn();
  const debounced = debounce(spy, 100, { leading: true, trailing: true });
  debounced('a');
  debounced('b');
  debounced('c');
  expect(spy.calls).toEqual([['a']]);
  advanceTimersByTime(100);
  expect(spy.calls).toEqual([['a'], ['c']]);
});

test('cancel drops the pending call', () => {
  useFakeTimers();
  const spy = fn();
  const debounced = debounce(spy, 100);
  debounced('a');
  advanceTimersByTime(50);
  debounced.cancel();
  advanceTimersByTime(500);
  expect(spy).toHaveBeenCalledTimes(0);
  debounced('b');
  advanceTimersByTime(100);
  expect(spy.calls).toEqual([['b']]);
});
