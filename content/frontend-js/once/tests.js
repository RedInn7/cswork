test.public('runs func once and repeats its result', () => {
  const spy = fn(() => 42);
  const init = once(spy);
  expect(init()).toBe(42);
  expect(init()).toBe(42);
  expect(spy).toHaveBeenCalledTimes(1);
});

test.public('the first call passes its arguments', () => {
  const add = once((a, b) => a + b);
  expect(add(2, 3)).toBe(5);
  expect(add(10, 10)).toBe(5);
});

test('an undefined result still counts', () => {
  const spy = fn();
  const run = once(spy);
  run();
  run();
  expect(spy).toHaveBeenCalledTimes(1);
});

test('passes this to func', () => {
  const obj = { value: 7, get: once(function () { return this.value; }) };
  expect(obj.get()).toBe(7);
});

test('each once() wrapper is separate', () => {
  const spy = fn((x) => x);
  const a = once(spy);
  const b = once(spy);
  expect(a('a')).toBe('a');
  expect(b('b')).toBe('b');
  expect(spy).toHaveBeenCalledTimes(2);
});

test('a throwing first call can be retried', () => {
  let attempts = 0;
  const flaky = once(() => {
    attempts += 1;
    if (attempts === 1) throw new Error('not yet');
    return 'ready';
  });
  expect(() => flaky()).toThrow('not yet');
  expect(flaky()).toBe('ready');
  expect(flaky()).toBe('ready');
});
