function myInstanceof(value, Constructor) {
  if (typeof Constructor !== 'function') throw new TypeError('Right-hand side is not callable');
  // A primitive is false before prototype is read, so 1 instanceof (() => {}) is false, not a TypeError.
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return false;
  const target = Constructor.prototype;
  if (target === null || (typeof target !== 'object' && typeof target !== 'function'))
    throw new TypeError('Constructor has no prototype object');
  for (let proto = Object.getPrototypeOf(value); proto !== null; proto = Object.getPrototypeOf(proto)) {
    if (proto === target) return true;
  }
  return false;
}
