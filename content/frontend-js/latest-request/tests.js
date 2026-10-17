/** A stub request answering `results[query]` after `delays[query]` ms. */
function stub(delays) {
  return fn((query) => new Promise((resolve) => setTimeout(() => resolve('results for ' + query), delays[query])));
}
const outcome = (promise) =>
  promise.then(
    (value) => ['ok', value],
    (error) => ['error', error.message],
  );

test.public('an older call is cancelled by a newer one', async () => {
  useFakeTimers();
  const search = latest(stub({ re: 100, react: 10 }));
  const first = outcome(search('re'));
  const second = outcome(search('react'));
  await advanceTimersByTimeAsync(200);
  expect(await first).toEqual(['error', 'cancelled']);
  expect(await second).toEqual(['ok', 'results for react']);
});

test.public('every call reaches the request at once', () => {
  useFakeTimers();
  const request = stub({ a: 5, b: 5 });
  const search = latest(request);
  search('a').catch(() => {});
  search('b');
  expect(request.calls).toEqual([['a'], ['b']]);
});

test('a slow old answer does not leak into the new call', async () => {
  useFakeTimers();
  const search = latest(stub({ old: 50, fresh: 80 }));
  const first = outcome(search('old'));
  const second = outcome(search('fresh'));
  await advanceTimersByTimeAsync(60);
  expect(await first).toEqual(['error', 'cancelled']);
  let early = null;
  second.then((value) => (early = value));
  await flushPromises();
  expect(early).toBe(null);
  await advanceTimersByTimeAsync(20);
  expect(await second).toEqual(['ok', 'results for fresh']);
});

test('the latest call passes its own rejection through', async () => {
  const search = latest(() => Promise.reject(new Error('500')));
  await expect(search('x')).rejects.toThrow('500');
});

test('a settled call is not cancelled later', async () => {
  useFakeTimers();
  const search = latest(stub({ a: 10, b: 10 }));
  const first = outcome(search('a'));
  await advanceTimersByTimeAsync(10);
  const second = outcome(search('b'));
  await advanceTimersByTimeAsync(10);
  expect(await first).toEqual(['ok', 'results for a']);
  expect(await second).toEqual(['ok', 'results for b']);
});

test('cancel() rejects the pending call', async () => {
  useFakeTimers();
  const search = latest(stub({ q: 30 }));
  const pending = outcome(search('q'));
  search.cancel();
  await advanceTimersByTimeAsync(50);
  expect(await pending).toEqual(['error', 'cancelled']);
});

test('passes this through to the request', async () => {
  const api = {
    prefix: '#',
    find: latest(function (q) {
      return Promise.resolve(this.prefix + q);
    }),
  };
  await expect(api.find('1')).resolves.toBe('#1');
});
