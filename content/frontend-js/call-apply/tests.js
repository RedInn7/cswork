function greet(greeting, mark) {
  return `${greeting}, ${this.name}${mark}`;
}

test.public('myCall sets this and passes arguments', () => {
  expect(greet.myCall({ name: 'Ada' }, 'Hi', '!')).toBe('Hi, Ada!');
});

test.public('myApply takes an array of arguments', () => {
  expect(greet.myApply({ name: 'Lin' }, ['Hello', '.'])).toBe('Hello, Lin.');
});

test('null or undefined this is the global object', () => {
  function self() {
    return this;
  }
  expect(self.myCall(null)).toBe(globalThis);
  expect(self.myApply(undefined)).toBe(globalThis);
});

test('primitives are wrapped', () => {
  function kind() {
    return [typeof this, this.valueOf()];
  }
  expect(kind.myCall('abc')).toEqual(['object', 'abc']);
  expect(kind.myCall(7)).toEqual(['object', 7]);
});

test('the object gains no property', () => {
  const obj = { name: 'x' };
  greet.myCall(obj, 'a', 'b');
  greet.myApply(obj, ['a', 'b']);
  expect(Object.keys(obj)).toEqual(['name']);
  expect(Object.getOwnPropertySymbols(obj)).toEqual([]);
});

test('a property named like a temp key is left alone', () => {
  const obj = { fn: 'mine', name: 'n' };
  function read() {
    return this.fn;
  }
  expect(read.myCall(obj)).toBe('mine');
  expect(obj.fn).toBe('mine');
});

test('myApply with no array passes no arguments', () => {
  function count() {
    return arguments.length;
  }
  expect(count.myApply({}, null)).toBe(0);
  expect(count.myApply({})).toBe(0);
  expect(count.myApply({}, { length: 2, 0: 'a', 1: 'b' })).toBe(2);
});

test('errors inside the function still clean up', () => {
  const obj = {};
  function boom() {
    throw new Error('inside');
  }
  expect(() => boom.myCall(obj)).toThrow('inside');
  expect(Object.getOwnPropertySymbols(obj)).toEqual([]);
});

test('works with a method borrowed from Array', () => {
  const like = { length: 2, 0: 'x', 1: 'y' };
  expect(Array.prototype.join.myCall(like, '-')).toBe('x-y');
});
