class Animal {}
class Dog extends Animal {}

test.public('built-in types', () => {
  expect(myInstanceof([], Array)).toBe(true);
  expect(myInstanceof([], Object)).toBe(true);
  expect(myInstanceof({}, Array)).toBe(false);
});

test.public('class inheritance', () => {
  const rex = new Dog();
  expect(myInstanceof(rex, Dog)).toBe(true);
  expect(myInstanceof(rex, Animal)).toBe(true);
  expect(myInstanceof(new Animal(), Dog)).toBe(false);
});

test('primitives are never instances', () => {
  expect(myInstanceof('str', String)).toBe(false);
  expect(myInstanceof(1, Number)).toBe(false);
  expect(myInstanceof(null, Object)).toBe(false);
  expect(myInstanceof(undefined, Object)).toBe(false);
});

test('boxed primitives are', () => {
  expect(myInstanceof(Object('str'), String)).toBe(true);
});

test('functions are objects too', () => {
  expect(myInstanceof(() => {}, Function)).toBe(true);
  expect(myInstanceof(Dog, Function)).toBe(true);
  expect(myInstanceof(Dog, Object)).toBe(true);
});

test('an object without a prototype', () => {
  expect(myInstanceof(Object.create(null), Object)).toBe(false);
});

test('a hand-made chain', () => {
  function Base() {}
  const middle = Object.create(Base.prototype);
  const leaf = Object.create(middle);
  expect(myInstanceof(leaf, Base)).toBe(true);
});

test('a bad right-hand side throws TypeError', () => {
  expect(() => myInstanceof({}, {})).toThrow(TypeError);
  expect(() => myInstanceof({}, () => {})).toThrow(TypeError);
  expect(() => myInstanceof(1, {})).toThrow(TypeError);
});

test('a primitive is false before the prototype is checked', () => {
  expect(myInstanceof(1, () => {})).toBe(1 instanceof (() => {}));
});

test('agrees with instanceof after the prototype is swapped', () => {
  function Shape() {}
  const s = new Shape();
  Shape.prototype = {};
  expect(myInstanceof(s, Shape)).toBe(s instanceof Shape);
});
