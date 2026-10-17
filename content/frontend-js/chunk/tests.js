test.public('the last chunk may be short', () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
});

test.public('an even split', () => {
  expect(chunk(['a', 'b', 'c', 'd'], 2)).toEqual([
    ['a', 'b'],
    ['c', 'd'],
  ]);
});

test('size defaults to 1', () => {
  expect(chunk([1, 2, 3])).toEqual([[1], [2], [3]]);
});

test('a size larger than the array', () => {
  expect(chunk(['a', 'b'], 5)).toEqual([['a', 'b']]);
});

test('a size below 1 gives []', () => {
  expect(chunk([1, 2], 0)).toEqual([]);
  expect(chunk([1, 2], -3)).toEqual([]);
});

test('a fractional size rounds down', () => {
  expect(chunk([1, 2, 3, 4, 5], 2.9)).toEqual([[1, 2], [3, 4], [5]]);
  expect(chunk([1, 2], 0.5)).toEqual([]);
});

test('an empty array', () => {
  expect(chunk([], 3)).toEqual([]);
});

test('leaves the input alone', () => {
  const input = [1, 2, 3];
  chunk(input, 2);
  expect(input).toEqual([1, 2, 3]);
});
