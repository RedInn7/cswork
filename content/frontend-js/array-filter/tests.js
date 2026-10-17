function own(body) {
  const saved = Array.prototype.filter;
  Array.prototype.filter = () => {
    throw new Error('Array.prototype.filter is switched off: write your own');
  };
  try {
    return body();
  } finally {
    Array.prototype.filter = saved;
  }
}

test.public('keeps the elements that pass', () => {
  const input = [1, 2, 3, 4];
  const out = own(() => input.myFilter((x) => x % 2 === 0));
  expect(out).toEqual([2, 4]);
  expect(input).toEqual([1, 2, 3, 4]);
});

test.public('truthy, not just true', () => {
  expect(own(() => ['a', '', 'b', 0, null].myFilter((x) => x))).toEqual(['a', 'b']);
});

test('the callback gets value, index and the array', () => {
  const input = ['x', 'y'];
  const spy = fn(() => true);
  own(() => input.myFilter(spy));
  expect(spy.calls).toEqual([
    ['x', 0, input],
    ['y', 1, input],
  ]);
});

test('thisArg becomes this', () => {
  const limits = { max: 2 };
  const out = own(() =>
    [1, 2, 3].myFilter(function (x) {
      return x <= this.max;
    }, limits),
  );
  expect(out).toEqual([1, 2]);
});

test('holes are skipped', () => {
  const spy = fn(() => true);
  const input = [1, 2, 3];
  delete input[1];
  const out = own(() => input.myFilter(spy));
  expect(spy).toHaveBeenCalledTimes(2);
  expect(out).toEqual([1, 3]);
});

test('elements added during the walk are not visited', () => {
  const input = [1, 2];
  const out = own(() =>
    input.myFilter((x, i, arr) => {
      arr.push(x + 10);
      return true;
    }),
  );
  expect(out).toEqual([1, 2]);
});

test('a non-function callback throws TypeError', () => {
  expect(() => own(() => [1].myFilter(null))).toThrow(TypeError);
});

test('works on an array-like object', () => {
  const out = own(() => Array.prototype.myFilter.call({ length: 3, 0: 5, 1: 50, 2: 500 }, (n) => n > 10));
  expect(out).toEqual([50, 500]);
});
