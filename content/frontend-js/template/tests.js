test.public('fills names and nested paths', () => {
  expect(renderTemplate('Hi {{ user.name }}, you have {{count}} new messages.', { user: { name: 'Ada' }, count: 3 })).toBe(
    'Hi Ada, you have 3 new messages.',
  );
});

test.public('a missing value becomes empty', () => {
  expect(renderTemplate('[{{ nope }}]', {})).toBe('[]');
});

test('falsy values still print', () => {
  expect(renderTemplate('{{a}}-{{b}}-{{c}}', { a: 0, b: false, c: '' })).toBe('0-false-');
});

test('null and a missing parent', () => {
  expect(renderTemplate('{{a}}|{{x.y.z}}', { a: null })).toBe('|');
});

test('single braces stay', () => {
  expect(renderTemplate('function () { return {{v}}; }', { v: 1 })).toBe('function () { return 1; }');
});

test('values are not rendered again', () => {
  expect(renderTemplate('{{a}}', { a: '{{b}}', b: 'no' })).toBe('{{b}}');
});

test('the same name twice, and array indexes', () => {
  expect(renderTemplate('{{x}}{{ x }} {{list.1}}', { x: 'ab', list: ['p', 'q'] })).toBe('abab q');
});

test('no placeholders', () => {
  expect(renderTemplate('plain text', { a: 1 })).toBe('plain text');
});

test('special characters in values are inserted literally', () => {
  expect(renderTemplate('{{a}}', { a: '$& $1 $$' })).toBe('$& $1 $$');
});
