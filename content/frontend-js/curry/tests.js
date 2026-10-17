const add3 = (a, b, c) => a + b + c;

test.public('one argument at a time', () => {
  expect(curry(add3)(1)(2)(3)).toBe(6);
});

test.public('any grouping of arguments', () => {
  const add = curry(add3);
  expect(add(1, 2)(3)).toBe(6);
  expect(add(1)(2, 3)).toBe(6);
  expect(add(1, 2, 3)).toBe(6);
});

test('partial functions can be reused', () => {
  const add = curry(add3);
  const plus10 = add(10);
  const plus15 = plus10(5);
  expect(plus15(1)).toBe(16);
  expect(plus15(2)).toBe(17);
  expect(plus10(0)(0)).toBe(10);
});

test('extra arguments are passed through', () => {
  const spy = fn((a, b) => a + b);
  const curried = curry(function (a, b) {
    return spy(...arguments);
  });
  curried(1)(2, 3);
  expect(spy).toHaveBeenCalledWith(1, 2, 3);
});

test('func runs only when enough arguments arrived', () => {
  const spy = fn();
  const curried = curry((a, b) => spy(a, b));
  const half = curried('a');
  expect(spy).toHaveBeenCalledTimes(0);
  half('b');
  expect(spy).toHaveBeenCalledTimes(1);
});

test('zero arity runs on the first call', () => {
  expect(curry(() => 42)()).toBe(42);
});

test('works for longer functions', () => {
  const join = curry((a, b, c, d, e) => [a, b, c, d, e].join(''));
  expect(join('a')('b', 'c')('d')('e')).toBe('abcde');
});
