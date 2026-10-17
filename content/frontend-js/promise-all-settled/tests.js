const later = (value, ms) => new Promise((resolve) => setTimeout(() => resolve(value), ms));
const failLater = (reason, ms) => new Promise((_, reject) => setTimeout(() => reject(reason), ms));
async function own(body) {
  const saved = [Promise.all, Promise.allSettled];
  Promise.all = Promise.allSettled = () => {
    throw new Error('Promise.all / Promise.allSettled are switched off: write your own');
  };
  try {
    return await body();
  } finally {
    [Promise.all, Promise.allSettled] = saved;
  }
}

test.public('reports every outcome in input order', () =>
  own(async () => {
    useFakeTimers();
    const p = promiseAllSettled([later('a', 30), failLater('bad', 10), 7]);
    await advanceTimersByTimeAsync(30);
    await expect(p).resolves.toEqual([
      { status: 'fulfilled', value: 'a' },
      { status: 'rejected', reason: 'bad' },
      { status: 'fulfilled', value: 7 },
    ]);
  }));

test.public('never rejects, even when everything fails', () =>
  own(async () => {
    const error = new Error('x');
    await expect(promiseAllSettled([Promise.reject(error)])).resolves.toEqual([{ status: 'rejected', reason: error }]);
  }));

test('an empty input gives []', () =>
  own(async () => {
    await expect(promiseAllSettled([])).resolves.toEqual([]);
  }));

test('waits for the slowest item', () =>
  own(async () => {
    useFakeTimers();
    let done = false;
    promiseAllSettled([failLater('fast', 5), later('slow', 80)]).then(() => (done = true));
    await advanceTimersByTimeAsync(79);
    expect(done).toBe(false);
    await advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  }));

test('takes any iterable', () =>
  own(async () => {
    function* items() {
      yield 1;
      yield Promise.resolve(2);
    }
    await expect(promiseAllSettled(items())).resolves.toEqual([
      { status: 'fulfilled', value: 1 },
      { status: 'fulfilled', value: 2 },
    ]);
  }));

test('a fulfilled result has no reason key and a rejected one no value key', () =>
  own(async () => {
    const [ok, bad] = await promiseAllSettled([1, Promise.reject(2)]);
    expect(Object.keys(ok).sort()).toEqual(['status', 'value']);
    expect(Object.keys(bad).sort()).toEqual(['reason', 'status']);
  }));
