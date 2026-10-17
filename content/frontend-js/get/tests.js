const data = () => ({
  user: { name: 'Ada', tags: [{ name: 'js' }, { name: 'css' }], address: null, score: 0, active: false, note: '' },
  matrix: [
    [1, 2],
    [3, 4],
  ],
});

test.public('dots and indexes', () => {
  expect(get(data(), 'user.tags[1].name')).toBe('css');
  expect(get(data(), 'user.name')).toBe('Ada');
});

test.public('a missing level gives the default', () => {
  expect(get(data(), 'user.phone.number', 'none')).toBe('none');
  expect(get(data(), 'user.phone.number')).toBe(undefined);
});

test('an array of keys', () => {
  expect(get(data(), ['user', 'tags', '0', 'name'])).toBe('js');
  expect(get(data(), ['user', 'tags', 0])).toEqual({ name: 'js' });
});

test('consecutive indexes', () => {
  expect(get(data(), 'matrix[1][0]')).toBe(3);
});

test('null on the way gives the default', () => {
  expect(get(data(), 'user.address.city', 'N/A')).toBe('N/A');
});

test('falsy values are returned as they are', () => {
  expect(get(data(), 'user.score', 99)).toBe(0);
  expect(get(data(), 'user.active', true)).toBe(false);
  expect(get(data(), 'user.note', 'x')).toBe('');
  expect(get(data(), 'user.address', 'x')).toBe(null);
});

test('a null or undefined object', () => {
  expect(get(null, 'a.b', 1)).toBe(1);
  expect(get(undefined, 'a', 2)).toBe(2);
});

test('array length and string methods are reachable', () => {
  expect(get(data(), 'user.tags.length')).toBe(2);
  expect(get({ s: 'abc' }, 's.length')).toBe(3);
});
