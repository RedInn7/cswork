const later = (value, ms) => new Promise((resolve) => setTimeout(() => resolve(value), ms));
const failLater = (reason, ms) => new Promise((_, reject) => setTimeout(() => reject(reason), ms));
async function own(body) {
  const saved = Promise.any;
  Promise.any = () => {
    throw new Error('Promise.any is switched off: write your own');
  };
  try {
    return await body();
  } finally {
    Promise.any = saved;
  }
}

test.public('fulfills with the first fulfilled value', () =>
  own(async () => {
    useFakeTimers();
    const p = promiseAny([failLater('a', 5), later('b', 20), later('c', 10)]);
    await advanceTimersByTimeAsync(20);
    await expect(p).resolves.toBe('c');
  }));

test.public('rejects with an AggregateError when all reject', () =>
  own(async () => {
    useFakeTimers();
    const p = promiseAny([failLater('slow', 30), failLater('fast', 10)]);
    p.catch(() => {});
    await advanceTimersByTimeAsync(30);
    const error = await p.then(
      () => null,
      (e) => e,
    );
    expect(error).toBeInstanceOf(AggregateError);
    expect(error.errors).toEqual(['slow', 'fast']);
  }));

test('a rejection does not end it early', () =>
  own(async () => {
    useFakeTimers();
    let settled = null;
    promiseAny([failLater('x', 5), later('y', 50)]).then(
      (v) => (settled = v),
      () => (settled = 'rejected'),
    );
    await advanceTimersByTimeAsync(10);
    expect(settled).toBe(null);
    await advanceTimersByTimeAsync(40);
    expect(settled).toBe('y');
  }));

test('an empty input rejects with an empty AggregateError', () =>
  own(async () => {
    const error = await promiseAny([]).then(
      () => null,
      (e) => e,
    );
    expect(error).toBeInstanceOf(AggregateError);
    expect(error.errors).toEqual([]);
  }));

test('a plain value fulfills it', () =>
  own(async () => {
    await expect(promiseAny([Promise.reject('no'), 42])).resolves.toBe(42);
  }));
