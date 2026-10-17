function own(body) {
  const saved = [Array.prototype.flat, Array.prototype.flatMap];
  Array.prototype.flat = Array.prototype.flatMap = () => {
    throw new Error('flat / flatMap are switched off: write your own');
  };
  try {
    return body();
  } finally {
    [Array.prototype.flat, Array.prototype.flatMap] = saved;
  }
}
const nested = () => [1, [2, [3, [4]]]];

test.public('one level by default', () =>
  own(() => {
    expect(flatten(nested())).toEqual([1, 2, [3, [4]]]);
  }));

test.public('a given depth', () =>
  own(() => {
    expect(flatten(nested(), 2)).toEqual([1, 2, 3, [4]]);
  }));

test('Infinity flattens everything', () =>
  own(() => {
    expect(flatten(nested(), Infinity)).toEqual([1, 2, 3, 4]);
    expect(flatten([[[[[['deep']]]]]], Infinity)).toEqual(['deep']);
  }));

test('depth 0 is a shallow copy', () =>
  own(() => {
    const input = [1, [2]];
    const out = flatten(input, 0);
    expect(out).toEqual([1, [2]]);
    expect(out).not.toBe(input);
    expect(out[1]).toBe(input[1]);
  }));

test('leaves the input alone', () =>
  own(() => {
    const input = nested();
    flatten(input, Infinity);
    expect(input).toEqual([1, [2, [3, [4]]]]);
  }));

test('strings and array-likes stay whole', () =>
  own(() => {
    const like = { 0: 'a', length: 1 };
    expect(flatten(['ab', ['cd'], like])).toEqual(['ab', 'cd', like]);
  }));

test('empty arrays disappear when flattened', () =>
  own(() => {
    expect(flatten([[], [[]], 1], 1)).toEqual([[], 1]);
  }));
