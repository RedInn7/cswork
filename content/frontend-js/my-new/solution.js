function myNew(Constructor, ...args) {
  if (typeof Constructor !== 'function') throw new TypeError(Constructor + ' is not a constructor');
  const proto = Constructor.prototype;
  const instance = Object.create(proto !== null && typeof proto === 'object' ? proto : Object.prototype);
  const result = Constructor.apply(instance, args);
  return result !== null && (typeof result === 'object' || typeof result === 'function') ? result : instance;
}
