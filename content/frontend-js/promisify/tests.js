function divide(a, b, callback) {
  setTimeout(() => (b === 0 ? callback(new Error('divide by zero')) : callback(null, a / b)), 10);
}

test.public('fulfills with the callback value', async () => {
  useFakeTimers();
  const p = promisify(divide)(6, 3);
  await advanceTimersByTimeAsync(10);
  await expect(p).resolves.toBe(2);
});

test.public('rejects with the callback error', async () => {
  useFakeTimers();
  const p = promisify(divide)(1, 0);
  p.catch(() => {});
  await advanceTimersByTimeAsync(10);
  await expect(p).rejects.toThrow('divide by zero');
});

test('returns a new function and leaves the original alone', () => {
  const wrapped = promisify(divide);
  expect(typeof wrapped).toBe('function');
  expect(wrapped).not.toBe(divide);
});

test('passes this through', async () => {
  const counter = {
    count: 41,
    next(callback) {
      callback(null, this.count + 1);
    },
  };
  counter.nextAsync = promisify(counter.next);
  await expect(counter.nextAsync()).resolves.toBe(42);
});

test('a synchronous callback works too', async () => {
  const echo = promisify((a, b, callback) => callback(null, [a, b]));
  await expect(echo('x', 'y')).resolves.toEqual(['x', 'y']);
});

test('a null error with a falsy value still fulfills', async () => {
  const zero = promisify((callback) => callback(null, 0));
  await expect(zero()).resolves.toBe(0);
});
