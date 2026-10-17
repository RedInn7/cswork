function own(body) {
  const saved = [Array.prototype.reduce, Array.prototype.reduceRight];
  Array.prototype.reduce = Array.prototype.reduceRight = () => {
    throw new Error('reduce / reduceRight are switched off: write your own');
  };
  try {
    return body();
  } finally {
    [Array.prototype.reduce, Array.prototype.reduceRight] = saved;
  }
}
const add = (a, b) => a + b;

test.public('without an initial value', () => {
  expect(own(() => [1, 2, 3].myReduce(add))).toBe(6);
});

test.public('with an initial value', () => {
  expect(own(() => [1, 2, 3].myReduce(add, 10))).toBe(16);
});

test('the callback gets acc, value, index and the array', () => {
  const input = [5, 6];
  const spy = fn((acc) => acc + 1);
  own(() => input.myReduce(spy, 0));
  expect(spy.calls).toEqual([
    [0, 5, 0, input],
    [1, 6, 1, input],
  ]);
});

test('without an initial value the walk starts at index 1', () => {
  const spy = fn((acc, x) => acc + x);
  own(() => [1, 2, 3].myReduce(spy));
  expect(spy.calls.length).toBe(2);
  expect(spy.calls[0][2]).toBe(1);
});

test('an explicit undefined counts as an initial value', () => {
  const out = own(() => [1, 2].myReduce((acc, x) => (acc === undefined ? 'start' : acc) + x, undefined));
  expect(out).toBe('start12');
});

test('an empty array with an initial value returns it', () => {
  expect(own(() => [].myReduce(add, 'init'))).toBe('init');
});

test('an empty array without one throws TypeError', () => {
  expect(() => own(() => [].myReduce(add))).toThrow(TypeError);
  const holes = [1, 2];
  delete holes[0];
  delete holes[1];
  expect(() => own(() => holes.myReduce(add))).toThrow(TypeError);
});

test('holes are skipped, also when picking the start', () => {
  const spy = fn((acc, x) => acc + x);
  const input = [0, 1, 0, 2];
  delete input[0];
  delete input[2];
  const out = own(() => input.myReduce(spy));
  expect(out).toBe(3);
  expect(spy).toHaveBeenCalledTimes(1);
});

test('a single element and no initial value: no call', () => {
  const spy = fn();
  expect(own(() => ['only'].myReduce(spy))).toBe('only');
  expect(spy).toHaveBeenCalledTimes(0);
});

test('builds an object', () => {
  const counts = own(() =>
    ['a', 'b', 'a'].myReduce((acc, w) => {
      acc[w] = (acc[w] || 0) + 1;
      return acc;
    }, {}),
  );
  expect(counts).toEqual({ a: 2, b: 1 });
});

test('a non-function callback throws TypeError', () => {
  expect(() => own(() => [1].myReduce({}))).toThrow(TypeError);
});
