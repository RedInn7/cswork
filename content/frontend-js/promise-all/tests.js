const later = (value, ms) => new Promise((resolve) => setTimeout(() => resolve(value), ms));
const failLater = (reason, ms) => new Promise((_, reject) => setTimeout(() => reject(reason), ms));
/** Runs body with Promise.all switched off. */
async function own(body) {
  const saved = Promise.all;
  Promise.all = () => {
    throw new Error('Promise.all is switched off: write your own');
  };
  try {
    return await body();
  } finally {
    Promise.all = saved;
  }
}

test.public('results come back in input order', () =>
  own(async () => {
    useFakeTimers();
    const p = promiseAll([later('a', 30), later('b', 10), later('c', 20)]);
    await advanceTimersByTimeAsync(30);
    await expect(p).resolves.toEqual(['a', 'b', 'c']);
  }));

test.public('plain values count as fulfilled', () =>
  own(async () => {
    await expect(promiseAll([1, Promise.resolve(2), 3])).resolves.toEqual([1, 2, 3]);
  }));

test('an empty input gives []', () =>
  own(async () => {
    await expect(promiseAll([])).resolves.toEqual([]);
  }));

test('takes any iterable', () =>
  own(async () => {
    await expect(promiseAll(new Set([Promise.resolve('x'), 'y']))).resolves.toEqual(['x', 'y']);
  }));

test('rejects with the first rejection, without waiting for the rest', () =>
  own(async () => {
    useFakeTimers();
    let settled = null;
    promiseAll([later(1, 100), failLater(new Error('second'), 50), failLater(new Error('first'), 20)]).then(
      () => (settled = 'fulfilled'),
      (error) => (settled = error.message),
    );
    await advanceTimersByTimeAsync(20);
    expect(settled).toBe('first');
  }));

test('waits for every promise before fulfilling', () =>
  own(async () => {
    useFakeTimers();
    let settled = false;
    promiseAll([later(1, 10), later(2, 100)]).then(() => (settled = true));
    await advanceTimersByTimeAsync(99);
    expect(settled).toBe(false);
    await advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
  }));

test('a repeated promise fills both slots', () =>
  own(async () => {
    const one = Promise.resolve('same');
    await expect(promiseAll([one, one])).resolves.toEqual(['same', 'same']);
  }));
