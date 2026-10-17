function own(body) {
  const saved = Function.prototype.bind;
  Function.prototype.bind = () => {
    throw new Error('Function.prototype.bind is switched off: write your own');
  };
  try {
    return body();
  } finally {
    Function.prototype.bind = saved;
  }
}
function Point(x, y) {
  this.x = x;
  this.y = y;
}
Point.prototype.sum = function () {
  return this.x + this.y;
};

test.public('binds this', () =>
  own(() => {
    const user = { name: 'Ada' };
    function hello() {
      return 'hi ' + this.name;
    }
    const bound = hello.myBind(user);
    expect(bound()).toBe('hi Ada');
    expect(bound.call({ name: 'other' })).toBe('hi Ada');
  }));

test.public('preset arguments come first', () =>
  own(() => {
    const add = (a, b, c) => a + b + c;
    expect(add.myBind(null, 1)(2, 3)).toBe(6);
    expect(add.myBind(null, 1, 2)(3)).toBe(6);
  }));

test('returns a new function and leaves the original alone', () =>
  own(() => {
    function f() {
      return this;
    }
    const bound = f.myBind(5);
    expect(bound).not.toBe(f);
    expect(typeof bound).toBe('function');
  }));

test('new ignores the bound this', () =>
  own(() => {
    const Bound = Point.myBind({ ignored: true }, 1);
    const p = new Bound(2);
    expect(p.x).toBe(1);
    expect(p.y).toBe(2);
    expect(p.ignored).toBe(undefined);
  }));

test('instances keep the original prototype', () =>
  own(() => {
    const AtOrigin = Point.myBind(null, 0);
    const p = new AtOrigin(5);
    expect(p instanceof Point).toBe(true);
    expect(p.sum()).toBe(5);
  }));

test('a constructor returning an object wins', () =>
  own(() => {
    function Factory() {
      this.lost = true;
      return { made: true };
    }
    const result = new (Factory.myBind(null))();
    expect(result).toEqual({ made: true });
  }));

test('calling it on a non-function throws TypeError', () =>
  own(() => {
    expect(() => Function.prototype.myBind.call({}, null)).toThrow(TypeError);
  }));

test('binding twice keeps the first this', () =>
  own(() => {
    function name() {
      return this.n;
    }
    const once = name.myBind({ n: 'first' });
    const twice = once.myBind({ n: 'second' });
    expect(twice()).toBe('first');
  }));
