test.public('a function key keeps the first of each', () => {
  expect(uniqBy([2.1, 1.2, 2.3, 1.9], Math.floor)).toEqual([2.1, 1.2]);
});

test.public('a property name', () => {
  const a = { id: 1, v: 'first' };
  const out = uniqBy([a, { id: 2 }, { id: 1, v: 'second' }], 'id');
  expect(out).toEqual([a, { id: 2 }]);
  expect(out[0]).toBe(a);
});

test('NaN keys are one key', () => {
  expect(uniqBy([NaN, 1, NaN], (x) => x)).toEqual([NaN, 1]);
});

test('object keys compare by reference', () => {
  const k = {};
  const items = [{ k }, { k }, { k: {} }];
  expect(uniqBy(items, 'k')).toHaveLength(2);
});

test('undefined is a key too', () => {
  expect(uniqBy([{ a: 1 }, {}, { b: 2 }], 'a')).toEqual([{ a: 1 }, {}]);
});

test('leaves the input alone', () => {
  const input = [1, 1, 2];
  const out = uniqBy(input, (x) => x);
  expect(input).toEqual([1, 1, 2]);
  expect(out).not.toBe(input);
});

test('strings and numbers are different keys', () => {
  expect(uniqBy([1, '1', 1], (x) => x)).toEqual([1, '1']);
});
