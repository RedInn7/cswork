test.public('evicts the least recently used', () => {
  const cache = new LRUCache(2);
  cache.put('a', 1);
  cache.put('b', 2);
  expect(cache.get('a')).toBe(1);
  cache.put('c', 3);
  expect(cache.get('b')).toBe(undefined);
  expect(cache.keys()).toEqual(['a', 'c']);
});

test.public('get on a missing key', () => {
  const cache = new LRUCache(1);
  expect(cache.get('nope')).toBe(undefined);
});

test('put on an existing key updates and refreshes it', () => {
  const cache = new LRUCache(2);
  cache.put('a', 1);
  cache.put('b', 2);
  cache.put('a', 10);
  cache.put('c', 3);
  expect(cache.get('a')).toBe(10);
  expect(cache.get('b')).toBe(undefined);
  expect(cache.size).toBe(2);
});

test('keys go from least to most recent', () => {
  const cache = new LRUCache(3);
  cache.put(1, 'one');
  cache.put(2, 'two');
  cache.put(3, 'three');
  cache.get(1);
  expect(cache.keys()).toEqual([2, 3, 1]);
});

test('a missing get does not change the order', () => {
  const cache = new LRUCache(2);
  cache.put('a', 1);
  cache.put('b', 2);
  cache.get('zzz');
  cache.put('c', 3);
  expect(cache.keys()).toEqual(['b', 'c']);
});

test('capacity 1', () => {
  const cache = new LRUCache(1);
  cache.put('a', 1);
  cache.put('b', 2);
  expect(cache.keys()).toEqual(['b']);
  expect(cache.size).toBe(1);
});

test('falsy values and keys are stored', () => {
  const cache = new LRUCache(3);
  cache.put(0, 0);
  cache.put('', false);
  cache.put(null, '');
  expect(cache.get(0)).toBe(0);
  expect(cache.get('')).toBe(false);
  expect(cache.get(null)).toBe('');
  expect(cache.size).toBe(3);
});

test('size counts entries', () => {
  const cache = new LRUCache(5);
  expect(cache.size).toBe(0);
  cache.put('a', 1);
  cache.put('a', 2);
  expect(cache.size).toBe(1);
});

test('many operations stay fast', () => {
  const cache = new LRUCache(1000);
  const started = Date.now();
  for (let i = 0; i < 200000; i++) {
    cache.put(i % 1500, i);
    cache.get((i * 7) % 1500);
  }
  expect(cache.size).toBe(1000);
  expect(Date.now() - started < 1500).toBe(true);
});

test('caches are separate', () => {
  const a = new LRUCache(2);
  const b = new LRUCache(2);
  a.put('k', 'a');
  expect(b.get('k')).toBe(undefined);
});
