const native = JSON.stringify;
/** Runs stringify with the built-in switched off, after computing what the built-in says. */
function same(value) {
  const expected = native(value);
  JSON.stringify = () => {
    throw new Error('JSON.stringify is switched off: write your own');
  };
  let actual;
  try {
    actual = stringify(value);
  } finally {
    JSON.stringify = native;
  }
  expect(actual).toBe(expected);
}
function throwsType(value) {
  JSON.stringify = () => {
    throw new Error('JSON.stringify is switched off: write your own');
  };
  try {
    expect(() => stringify(value)).toThrow(TypeError);
  } finally {
    JSON.stringify = native;
  }
}

test.public('a nested object', () => {
  same({ name: 'Ada', tags: ['js', 'css'], meta: { age: 36, admin: false, boss: null } });
});

test.public('undefined in objects and arrays', () => {
  same({ a: [1, 'x', null, undefined], b: undefined, c: () => 1 });
});

test('primitives', () => {
  for (const v of [null, true, false, 0, -0, 42, -3.5, 1e21, 'text', ''])
    same(v);
});

test('NaN and Infinity become null', () => {
  same([NaN, Infinity, -Infinity]);
});

test('escapes', () => {
  same('quote " backslash \\ newline \n tab \t return \r bell \u0007 nul \u0000 form \f back \b unit \u001f');
});

test('unicode passes through', () => {
  same({ city: '北京', emoji: '😀', line: ' ' });
});

test('toJSON and dates', () => {
  same({ when: new Date(0), custom: { toJSON: () => ({ replaced: true }) } });
});

test('toJSON gets the key', () => {
  const probe = { toJSON: (key) => 'key=' + key };
  same({ field: probe, list: [probe] });
  same(probe);
});

test('top-level values that are skipped', () => {
  same(undefined);
  same(() => 1);
  same(Symbol('s'));
});

test('functions and symbols inside arrays', () => {
  same([() => 1, Symbol('s'), undefined]);
});

test('empty containers and deep nesting', () => {
  same({ a: {}, b: [], c: [[[[{ d: [] }]]]] });
});

test('a cycle throws TypeError', () => {
  const loop = { name: 'loop' };
  loop.self = loop;
  throwsType(loop);
});

test('a BigInt throws TypeError', () => {
  throwsType({ big: BigInt(1) });
});

test('the same object twice is not a cycle', () => {
  const shared = { x: 1 };
  same({ a: shared, b: shared, list: [shared, shared] });
});
