async function own(body) {
  const saved = globalThis.structuredClone;
  globalThis.structuredClone = () => {
    throw new Error('structuredClone is switched off: write your own');
  };
  try {
    return await body();
  } finally {
    globalThis.structuredClone = saved;
  }
}

test.public('copies nested objects and arrays', () =>
  own(() => {
    const source = { a: 1, list: [1, { x: 2 }], nested: { deep: { text: 'hi' } } };
    const copy = deepClone(source);
    expect(copy).toEqual(source);
    expect(copy).not.toBe(source);
    expect(copy.list).not.toBe(source.list);
    expect(copy.list[1]).not.toBe(source.list[1]);
    copy.nested.deep.text = 'changed';
    expect(source.nested.deep.text).toBe('hi');
  }));

test.public('a cycle points back at the copy', () =>
  own(() => {
    const a = { name: 'a' };
    a.self = a;
    const copy = deepClone(a);
    expect(copy.self).toBe(copy);
    expect(copy).not.toBe(a);
  }));

test('primitives and functions come back as they are', () =>
  own(() => {
    const f = () => 1;
    expect(deepClone(5)).toBe(5);
    expect(deepClone('s')).toBe('s');
    expect(deepClone(null)).toBe(null);
    expect(deepClone(undefined)).toBe(undefined);
    expect(deepClone(f)).toBe(f);
    expect(deepClone({ f }).f).toBe(f);
  }));

test('shared references stay shared', () =>
  own(() => {
    const shared = { n: 1 };
    const copy = deepClone({ left: shared, right: shared });
    expect(copy.left).toBe(copy.right);
    expect(copy.left).not.toBe(shared);
  }));

test('Date and RegExp are new objects', () =>
  own(() => {
    const when = new Date(86400000);
    const pattern = /ab+c/gi;
    const copy = deepClone({ when, pattern });
    expect(copy.when).toBeInstanceOf(Date);
    expect(copy.when).not.toBe(when);
    expect(copy.when.getTime()).toBe(86400000);
    expect(copy.pattern).not.toBe(pattern);
    expect(copy.pattern.source).toBe('ab+c');
    expect(copy.pattern.flags).toBe('gi');
  }));

test('Map and Set contents are deep copies', () =>
  own(() => {
    const inner = { v: 1 };
    const source = { map: new Map([['k', inner]]), set: new Set([inner]) };
    const copy = deepClone(source);
    expect(copy.map).toBeInstanceOf(Map);
    expect(copy.map.get('k')).toEqual({ v: 1 });
    expect(copy.map.get('k')).not.toBe(inner);
    expect([...copy.set][0]).toBe(copy.map.get('k'));
  }));

test('class instances keep their prototype', () =>
  own(() => {
    class Point {
      constructor(x, y) {
        this.x = x;
        this.y = y;
      }
      length() {
        return Math.hypot(this.x, this.y);
      }
    }
    const copy = deepClone(new Point(3, 4));
    expect(copy).toBeInstanceOf(Point);
    expect(copy.length()).toBe(5);
  }));

test('a cycle through an array', () =>
  own(() => {
    const list = [1];
    list.push(list);
    const copy = deepClone(list);
    expect(copy[1]).toBe(copy);
    expect(copy[0]).toBe(1);
  }));
