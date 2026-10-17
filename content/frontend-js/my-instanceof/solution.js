function myInstanceof(value, Constructor) {
  if (typeof Constructor !== 'function') throw new TypeError('Right-hand side is not callable');
  const target = Constructor.prototype;
  if (target === null || (typeof target !== 'object' && typeof target !== 'function'))
    throw new TypeError('Constructor has no prototype object');
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return false;
  for (let proto = Object.getPrototypeOf(value); proto !== null; proto = Object.getPrototypeOf(proto)) {
    if (proto === target) return true;
  }
  return false;
}
