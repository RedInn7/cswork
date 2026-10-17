function own(body) {
  const saved = Object.create;
  Object.create = () => {
    throw new Error('Object.create is switched off: write your own');
  };
  try {
    return body();
  } finally {
    Object.create = saved;
  }
}
const animal = {
  speak() {
    return this.name + ' makes a sound';
  },
};

test.public('the new object inherits from proto', () => {
  const dog = own(() => objectCreate(animal));
  dog.name = 'Rex';
  expect(dog.speak()).toBe('Rex makes a sound');
  expect(Object.getPrototypeOf(dog)).toBe(animal);
  expect(Object.keys(dog)).toEqual(['name']);
});

test.public('null means no prototype', () => {
  const bare = own(() => objectCreate(null));
  expect(Object.getPrototypeOf(bare)).toBe(null);
  expect('toString' in bare).toBe(false);
});

test('a bad proto throws TypeError', () => {
  expect(() => own(() => objectCreate(5))).toThrow(TypeError);
  expect(() => own(() => objectCreate(undefined))).toThrow(TypeError);
  expect(() => own(() => objectCreate('x'))).toThrow(TypeError);
});

test('properties are defined from descriptors', () => {
  const point = own(() =>
    objectCreate(
      {},
      {
        x: { value: 1, enumerable: true },
        hidden: { value: 2 },
      },
    ),
  );
  expect(point.x).toBe(1);
  expect(point.hidden).toBe(2);
  expect(Object.keys(point)).toEqual(['x']);
  point.x = 99;
  expect(point.x).toBe(1);
});

test('each call makes a separate object', () => {
  const a = own(() => objectCreate(animal));
  const b = own(() => objectCreate(animal));
  expect(a).not.toBe(b);
  a.name = 'a';
  expect(b.name).toBe(undefined);
});

test('a function can be the prototype', () => {
  function base() {}
  const child = own(() => objectCreate(base));
  expect(Object.getPrototypeOf(child)).toBe(base);
});

test('changes to proto show through', () => {
  const proto = { a: 1 };
  const child = own(() => objectCreate(proto));
  proto.a = 2;
  expect(child.a).toBe(2);
});
