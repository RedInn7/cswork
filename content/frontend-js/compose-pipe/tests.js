const inc = (x) => x + 1;
const double = (x) => x * 2;
const square = (x) => x * x;

test.public('compose runs right to left', () => {
  expect(compose(inc, double)(3)).toBe(7);
  expect(compose(square, inc, double)(3)).toBe(49);
});

test.public('pipe runs left to right', () => {
  expect(pipe(inc, double)(3)).toBe(8);
  expect(pipe(square, inc, double)(3)).toBe(20);
});

test('the first function may take several arguments', () => {
  const add = (a, b) => a + b;
  expect(pipe(add, double)(2, 3)).toBe(10);
  expect(compose(double, add)(2, 3)).toBe(10);
});

test('no functions: identity', () => {
  expect(pipe()(5)).toBe(5);
  expect(compose()('x')).toBe('x');
});

test('a single function', () => {
  expect(pipe(double)(4)).toBe(8);
  expect(compose(double)(4)).toBe(8);
});

test('the composed function can run again', () => {
  const fns = [inc, double];
  const f = compose(...fns);
  expect(f(1)).toBe(3);
  expect(f(1)).toBe(3);
  expect(fns).toEqual([inc, double]);
});
