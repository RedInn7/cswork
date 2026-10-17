Object.defineProperty(Array.prototype, 'myFilter', {
  configurable: true,
  writable: true,
  value: function (callback, thisArg) {
    if (typeof callback !== 'function') throw new TypeError(callback + ' is not a function');
    const source = Object(this);
    const length = source.length >>> 0;
    const result = [];
    for (let i = 0; i < length; i++) {
      if (!(i in source)) continue;
      const value = source[i];
      if (callback.call(thisArg, value, i, source)) result.push(value);
    }
    return result;
  },
});
