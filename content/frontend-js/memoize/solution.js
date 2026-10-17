function memoize(func, resolver) {
  function memoized(...args) {
    const key = resolver ? resolver.apply(this, args) : args[0];
    if (memoized.cache.has(key)) return memoized.cache.get(key);
    const result = func.apply(this, args);
    memoized.cache.set(key, result);
    return result;
  }
  memoized.cache = new Map();
  return memoized;
}
