function Dog(name) {
  this.name = name;
}
Dog.prototype.bark = function () {
  return this.name + ' says woof';
};

test.public('sets fields and the prototype', () => {
  const d = myNew(Dog, 'Rex');
  expect(d.name).toBe('Rex');
  expect(d.bark()).toBe('Rex says woof');
  expect(d instanceof Dog).toBe(true);
  expect(Object.getPrototypeOf(d)).toBe(Dog.prototype);
});

test.public('passes every argument', () => {
  function Box(...items) {
    this.items = items;
  }
  expect(myNew(Box, 1, 2, 3).items).toEqual([1, 2, 3]);
});

test('a returned object replaces the instance', () => {
  function Factory() {
    this.lost = true;
    return { made: true };
  }
  expect(myNew(Factory)).toEqual({ made: true });
});

test('a returned function or array replaces the instance', () => {
  const inner = () => 1;
  function GivesFn() {
    return inner;
  }
  function GivesArray() {
    return [1];
  }
  expect(myNew(GivesFn)).toBe(inner);
  expect(myNew(GivesArray)).toEqual([1]);
});

test('a returned primitive or null is ignored', () => {
  function GivesNumber() {
    this.kept = true;
    return 42;
  }
  function GivesNull() {
    this.kept = true;
    return null;
  }
  expect(myNew(GivesNumber).kept).toBe(true);
  expect(myNew(GivesNull).kept).toBe(true);
});

test('each call makes a separate object', () => {
  const a = myNew(Dog, 'a');
  const b = myNew(Dog, 'b');
  expect(a).not.toBe(b);
  expect(a.name).toBe('a');
});

test('inherited prototypes work', () => {
  function Animal(name) {
    this.name = name;
  }
  Animal.prototype.hello = function () {
    return 'I am ' + this.name;
  };
  function Cat(name) {
    Animal.call(this, name);
  }
  Cat.prototype = Object.create(Animal.prototype);
  const c = myNew(Cat, 'Tom');
  expect(c.hello()).toBe('I am Tom');
  expect(c instanceof Animal).toBe(true);
});
