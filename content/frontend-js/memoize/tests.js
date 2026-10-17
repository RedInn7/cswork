test.public('computes each argument once', () => {
  const square = fn((n) => n * n);
  const fast = memoize(square);
  expect(fast(4)).toBe(16);
  expect(fast(4)).toBe(16);
  expect(fast(5)).toBe(25);
  expect(square).toHaveBeenCalledTimes(2);
});

test.public('the default key is the first argument', () => {
  const add = fn((a, b) => a + b);
  const fast = memoize(add);
  expect(fast(1, 2)).toBe(3);
  expect(fast(1, 100)).toBe(3);
  expect(add).toHaveBeenCalledTimes(1);
});

test('a resolver builds the key', () => {
  const area = fn((w, h) => w * h);
  const fast = memoize(area, (w, h) => w + 'x' + h);
  expect(fast(2, 3)).toBe(6);
  expect(fast(3, 2)).toBe(6);
  expect(fast(2, 3)).toBe(6);
  expect(area).toHaveBeenCalledTimes(2);
});

test('undefined results are cached', () => {
  const nothing = fn(() => undefined);
  const fast = memoize(nothing);
  fast('a');
  fast('a');
  expect(nothing).toHaveBeenCalledTimes(1);
});

test('cache is a Map that can be cleared', () => {
  const square = fn((n) => n * n);
  const fast = memoize(square);
  fast(3);
  expect(fast.cache).toBeInstanceOf(Map);
  expect(fast.cache.get(3)).toBe(9);
  fast.cache.clear();
  fast(3);
  expect(square).toHaveBeenCalledTimes(2);
});

test('object keys use identity', () => {
  const size = fn((obj) => Object.keys(obj).length);
  const fast = memoize(size);
  const a = { x: 1 };
  fast(a);
  fast(a);
  fast({ x: 1 });
  expect(size).toHaveBeenCalledTimes(2);
});

test('passes this through', () => {
  const counter = { base: 10, plus: memoize(function (n) { return this.base + n; }) };
  expect(counter.plus(5)).toBe(15);
});

test('each memoized function has its own cache', () => {
  const a = memoize((n) => 'a' + n);
  const b = memoize((n) => 'b' + n);
  expect(a(1)).toBe('a1');
  expect(b(1)).toBe('b1');
});
