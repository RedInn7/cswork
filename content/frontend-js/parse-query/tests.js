function own(body) {
  const saved = globalThis.URLSearchParams;
  globalThis.URLSearchParams = class {
    constructor() {
      throw new Error('URLSearchParams is switched off: write your own');
    }
  };
  try {
    return body();
  } finally {
    globalThis.URLSearchParams = saved;
  }
}

test.public('pairs, repeats and a bare key', () => {
  expect(own(() => parseQuery('?q=js+closure&tag=a&tag=b&debug'))).toEqual({ q: 'js closure', tag: ['a', 'b'], debug: '' });
});

test.public('percent-encoding and = inside a value', () => {
  expect(own(() => parseQuery('redirect=%2Fhome%3Fx%3D1&eq=a=b'))).toEqual({ redirect: '/home?x=1', eq: 'a=b' });
});

test('the leading ? is optional', () => {
  expect(own(() => parseQuery('a=1'))).toEqual({ a: '1' });
});

test('empty input', () => {
  expect(own(() => parseQuery(''))).toEqual({});
  expect(own(() => parseQuery('?'))).toEqual({});
});

test('empty pieces are skipped', () => {
  expect(own(() => parseQuery('a=1&&b=2&'))).toEqual({ a: '1', b: '2' });
});

test('an empty value is an empty string', () => {
  expect(own(() => parseQuery('a=&b'))).toEqual({ a: '', b: '' });
});

test('three repeats make one array', () => {
  expect(own(() => parseQuery('x=1&x=2&x=3'))).toEqual({ x: ['1', '2', '3'] });
});

test('keys are decoded too, and %2B stays a plus', () => {
  expect(own(() => parseQuery('first+name=Ada&sum=1%2B1'))).toEqual({ 'first name': 'Ada', sum: '1+1' });
});

test('unicode', () => {
  expect(own(() => parseQuery('city=%E5%8C%97%E4%BA%AC'))).toEqual({ city: '北京' });
});

test('a key named like an Object method', () => {
  expect(own(() => parseQuery('constructor=1&toString=2'))).toEqual({ constructor: '1', toString: '2' });
});
