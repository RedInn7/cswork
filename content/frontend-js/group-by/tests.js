function own(body) {
  const saved = [Object.groupBy, Map.groupBy];
  Object.groupBy = Map.groupBy = () => {
    throw new Error('Object.groupBy / Map.groupBy are switched off: write your own');
  };
  try {
    return body();
  } finally {
    [Object.groupBy, Map.groupBy] = saved;
  }
}

test.public('a function key', () =>
  own(() => {
    expect(groupBy([6.1, 4.2, 6.3], Math.floor)).toEqual({ 6: [6.1, 6.3], 4: [4.2] });
  }));

test.public('a property name', () =>
  own(() => {
    expect(groupBy(['one', 'two', 'three'], 'length')).toEqual({ 3: ['one', 'two'], 5: ['three'] });
  }));

test('groups keep the input order', () =>
  own(() => {
    const people = [
      { name: 'a', team: 'red' },
      { name: 'b', team: 'blue' },
      { name: 'c', team: 'red' },
    ];
    const out = groupBy(people, 'team');
    expect(out.red.map((p) => p.name)).toEqual(['a', 'c']);
    expect(out.red[0]).toBe(people[0]);
  }));

test('the function gets the index', () =>
  own(() => {
    expect(groupBy(['a', 'b', 'c', 'd'], (_, i) => (i % 2 ? 'odd' : 'even'))).toEqual({ even: ['a', 'c'], odd: ['b', 'd'] });
  }));

test('keys are strings', () =>
  own(() => {
    const out = groupBy([1, 2, 3], (n) => n > 1);
    expect(Object.keys(out).sort()).toEqual(['false', 'true']);
  }));

test('an empty array gives an empty object', () =>
  own(() => {
    expect(groupBy([], 'x')).toEqual({});
  }));

test('a key named like an Object method is a normal group', () =>
  own(() => {
    const out = groupBy(['toString', 'valueOf', 'toString'], (w) => w);
    expect(out.toString).toEqual(['toString', 'toString']);
    expect(out.valueOf).toEqual(['valueOf']);
  }));
