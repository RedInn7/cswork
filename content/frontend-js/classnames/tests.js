test.public('strings, objects and arrays', () => {
  expect(classNames('btn', { active: true, disabled: false }, ['lg', ['round']])).toBe('btn active lg round');
});

test.public('falsy values are skipped', () => {
  expect(classNames(null, '', 0, undefined, false, 'ok')).toBe('ok');
});

test('numbers count when truthy', () => {
  expect(classNames(1, 'a', 0, 2)).toBe('1 a 2');
});

test('object values are checked for truthiness', () => {
  expect(classNames({ a: 1, b: 0, c: 'yes', d: '', e: null })).toBe('a c');
});

test('true and functions are ignored', () => {
  expect(classNames(true, () => 'x', 'y')).toBe('y');
});

test('no arguments gives an empty string', () => {
  expect(classNames()).toBe('');
  expect(classNames([], {})).toBe('');
});

test('duplicates stay, order is kept', () => {
  expect(classNames('a', ['b', 'a'], { a: true })).toBe('a b a a');
});

test('deep nesting', () => {
  expect(classNames([[[['deep', { on: true }]]]])).toBe('deep on');
});
