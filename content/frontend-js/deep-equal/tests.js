test.public('nested objects with keys in another order', () => {
  expect(deepEqual({ a: [1, 2], b: { c: 3 } }, { b: { c: 3 }, a: [1, 2] })).toBe(true);
});

test.public('a different value deep inside', () => {
  expect(deepEqual({ a: [1, { x: 2 }] }, { a: [1, { x: 3 }] })).toBe(false);
});

test('primitives', () => {
  expect(deepEqual(1, 1)).toBe(true);
  expect(deepEqual('a', 'a')).toBe(true);
  expect(deepEqual(1, '1')).toBe(false);
  expect(deepEqual(null, undefined)).toBe(false);
  expect(deepEqual(true, 1)).toBe(false);
});

test('NaN equals NaN', () => {
  expect(deepEqual(NaN, NaN)).toBe(true);
  expect(deepEqual([NaN], [NaN])).toBe(true);
  expect(deepEqual(NaN, 0)).toBe(false);
});

test('arrays are not array-like objects', () => {
  expect(deepEqual([1, 2], { 0: 1, 1: 2, length: 2 })).toBe(false);
  expect(deepEqual([], {})).toBe(false);
});

test('null is not an empty object', () => {
  expect(deepEqual(null, {})).toBe(false);
  expect(deepEqual({}, null)).toBe(false);
  expect(deepEqual({ a: null }, { a: {} })).toBe(false);
});

test('missing keys and extra keys', () => {
  expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  expect(deepEqual({ a: undefined }, { b: undefined })).toBe(false);
  expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
});

test('array length and order matter', () => {
  expect(deepEqual([1, 2, 3], [1, 2])).toBe(false);
  expect(deepEqual([1, 2], [2, 1])).toBe(false);
});

test('dates compare by time', () => {
  expect(deepEqual(new Date(1000), new Date(1000))).toBe(true);
  expect(deepEqual(new Date(1000), new Date(2000))).toBe(false);
  expect(deepEqual(new Date(0), {})).toBe(false);
});
