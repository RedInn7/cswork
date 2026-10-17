test.public('creates missing objects and arrays', () => {
  const config = {};
  set(config, 'server.ports[0]', 8080);
  expect(config).toEqual({ server: { ports: [8080] } });
  expect(Array.isArray(config.server.ports)).toBe(true);
});

test.public('returns the same object', () => {
  const target = { a: 1 };
  expect(set(target, 'b', 2)).toBe(target);
  expect(target).toEqual({ a: 1, b: 2 });
});

test('keeps what is already there', () => {
  const target = { server: { host: 'x', ports: [1, 2] } };
  const ports = target.server.ports;
  set(target, 'server.ports[2]', 3);
  expect(target.server.ports).toBe(ports);
  expect(target).toEqual({ server: { host: 'x', ports: [1, 2, 3] } });
});

test('an array of keys', () => {
  const target = {};
  set(target, ['list', 1, 'name'], 'b');
  expect(Array.isArray(target.list)).toBe(true);
  expect(target.list[1]).toEqual({ name: 'b' });
  expect(target.list.length).toBe(2);
});

test('a numeric-looking key makes an array only when it is a whole number', () => {
  const target = {};
  set(target, 'a.1x.b', true);
  set(target, 'c.-1', true);
  expect(Array.isArray(target.a)).toBe(false);
  expect(target.a['1x'].b).toBe(true);
  expect(Array.isArray(target.c)).toBe(false);
});

test('replaces a primitive or null on the way', () => {
  const target = { a: 5, b: null };
  set(target, 'a.x', 1);
  set(target, 'b[0]', 'y');
  expect(target).toEqual({ a: { x: 1 }, b: ['y'] });
});

test('overwrites the last key', () => {
  const target = { a: { b: { c: 1 } } };
  set(target, 'a.b', 'flat');
  expect(target).toEqual({ a: { b: 'flat' } });
});
