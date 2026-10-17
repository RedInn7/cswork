test.public('on and emit pass the arguments', () => {
  const bus = new EventEmitter();
  const spy = fn();
  bus.on('save', spy);
  expect(bus.emit('save', 'doc', 2)).toBe(true);
  expect(spy.calls).toEqual([['doc', 2]]);
});

test.public('once runs a single time', () => {
  const bus = new EventEmitter();
  const spy = fn();
  bus.once('ready', spy);
  bus.emit('ready', 1);
  bus.emit('ready', 2);
  expect(spy.calls).toEqual([[1]]);
});

test('listeners run in registration order with this = emitter', () => {
  const bus = new EventEmitter();
  const order = [];
  let seen;
  bus.on('x', () => order.push('a'));
  bus.on('x', function () {
    seen = this;
    order.push('b');
  });
  bus.emit('x');
  expect(order).toEqual(['a', 'b']);
  expect(seen).toBe(bus);
});

test('emit without listeners returns false', () => {
  const bus = new EventEmitter();
  expect(bus.emit('nobody')).toBe(false);
  const spy = fn();
  bus.on('gone', spy).off('gone', spy);
  expect(bus.emit('gone')).toBe(false);
});

test('on, once and off chain', () => {
  const bus = new EventEmitter();
  const spy = fn();
  expect(bus.on('a', spy)).toBe(bus);
  expect(bus.once('a', spy)).toBe(bus);
  expect(bus.off('a', spy)).toBe(bus);
});

test('off removes one registration, the latest', () => {
  const bus = new EventEmitter();
  const calls = [];
  const a = () => calls.push('a');
  const b = () => calls.push('b');
  bus.on('e', a);
  bus.on('e', b);
  bus.on('e', a);
  bus.off('e', a);
  bus.emit('e');
  expect(calls).toEqual(['a', 'b']);
});

test('a once listener can be removed by the original function', () => {
  const bus = new EventEmitter();
  const spy = fn();
  bus.once('e', spy);
  bus.off('e', spy);
  expect(bus.emit('e')).toBe(false);
  expect(spy).toHaveBeenCalledTimes(0);
});

test('a listener added during emit waits for the next emit', () => {
  const bus = new EventEmitter();
  const late = fn();
  bus.on('e', () => bus.on('e', late));
  bus.emit('e');
  expect(late).toHaveBeenCalledTimes(0);
  bus.emit('e');
  expect(late).toHaveBeenCalledTimes(1);
});

test('a once listener that emits again does not loop', () => {
  const bus = new EventEmitter();
  const spy = fn();
  bus.once('e', () => {
    spy();
    bus.emit('e');
  });
  bus.emit('e');
  expect(spy).toHaveBeenCalledTimes(1);
});

test('events do not mix and emitters do not share listeners', () => {
  const one = new EventEmitter();
  const two = new EventEmitter();
  const spy = fn();
  one.on('a', spy);
  two.emit('a');
  one.emit('b');
  expect(spy).toHaveBeenCalledTimes(0);
});

test('off for an unknown listener is harmless', () => {
  const bus = new EventEmitter();
  const spy = fn();
  bus.on('e', spy);
  bus.off('e', () => {});
  bus.off('missing', spy);
  bus.emit('e');
  expect(spy).toHaveBeenCalledTimes(1);
});
