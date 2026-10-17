/** Runs body with the built-in map switched off; restored before any expect. */
function own(body) {
  const saved = Array.prototype.map;
  Array.prototype.map = () => {
    throw new Error('Array.prototype.map is switched off: write your own');
  };
  try {
    return body();
  } finally {
    Array.prototype.map = saved;
  }
}

test.public('maps every element into a new array', () => {
  const input = [1, 2, 3];
  const out = own(() => input.myMap((x) => x * 2));
  expect(out).toEqual([2, 4, 6]);
  expect(out).not.toBe(input);
  expect(input).toEqual([1, 2, 3]);
});

test.public('the callback gets value, index and the array', () => {
  const input = ['a', 'b'];
  const spy = fn(() => 0);
  own(() => input.myMap(spy));
  expect(spy.calls).toEqual([
    ['a', 0, input],
    ['b', 1, input],
  ]);
  expect(spy.calls[0][2]).toBe(input);
});

test('thisArg becomes this', () => {
  const scale = { by: 10 };
  const out = own(() =>
    [1, 2].myMap(function (x) {
      return x * this.by;
    }, scale),
  );
  expect(out).toEqual([10, 20]);
});

test('holes are skipped and kept', () => {
  const spy = fn((x) => x * 2);
  const input = [1, 2, 3];
  delete input[1];
  const out = own(() => input.myMap(spy));
  expect(spy).toHaveBeenCalledTimes(2);
  expect(out.length).toBe(3);
  expect(1 in out).toBe(false);
  expect(out[2]).toBe(6);
});

test('elements added during the walk are not visited', () => {
  const input = [1, 2];
  const out = own(() =>
    input.myMap((x, i, arr) => {
      arr.push(x);
      return x;
    }),
  );
  expect(out).toEqual([1, 2]);
});

test('a non-function callback throws TypeError', () => {
  expect(() => own(() => [1].myMap('nope'))).toThrow(TypeError);
});

test('works on an array-like object', () => {
  const out = own(() => Array.prototype.myMap.call({ length: 2, 0: 'a', 1: 'b' }, (s) => s.toUpperCase()));
  expect(out).toEqual(['A', 'B']);
});

test('an undefined result is still an element', () => {
  const out = own(() => [1, 2].myMap(() => undefined));
  expect(out.length).toBe(2);
  expect(0 in out).toBe(true);
});
