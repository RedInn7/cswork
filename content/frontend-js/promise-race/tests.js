const later = (value, ms) => new Promise((resolve) => setTimeout(() => resolve(value), ms));
const failLater = (reason, ms) => new Promise((_, reject) => setTimeout(() => reject(reason), ms));
async function own(body) {
  const saved = Promise.race;
  Promise.race = () => {
    throw new Error('Promise.race is switched off: write your own');
  };
  try {
    return await body();
  } finally {
    Promise.race = saved;
  }
}

test.public('follows the first to fulfill', () =>
  own(async () => {
    useFakeTimers();
    const p = promiseRace([later('slow', 50), later('fast', 10)]);
    await advanceTimersByTimeAsync(10);
    await expect(p).resolves.toBe('fast');
  }));

test.public('follows the first to reject', () =>
  own(async () => {
    useFakeTimers();
    const p = promiseRace([later('slow', 50), failLater(new Error('timeout'), 20)]);
    await advanceTimersByTimeAsync(20);
    await expect(p).rejects.toThrow('timeout');
  }));

test('a plain value wins over a pending promise', () =>
  own(async () => {
    useFakeTimers();
    await expect(promiseRace([later('late', 10), 'now'])).resolves.toBe('now');
  }));

test('later results do not change the outcome', () =>
  own(async () => {
    useFakeTimers();
    const outcomes = [];
    promiseRace([later('first', 10), failLater('second', 20)]).then(
      (v) => outcomes.push(['ok', v]),
      (e) => outcomes.push(['err', e]),
    );
    await advanceTimersByTimeAsync(50);
    expect(outcomes).toEqual([['ok', 'first']]);
  }));

test('an empty input stays pending', () =>
  own(async () => {
    let settled = false;
    promiseRace([]).then(
      () => (settled = true),
      () => (settled = true),
    );
    await flushPromises();
    expect(settled).toBe(false);
  }));

test('takes any iterable', () =>
  own(async () => {
    await expect(promiseRace(new Set([Promise.resolve('set')]))).resolves.toBe('set');
  }));
