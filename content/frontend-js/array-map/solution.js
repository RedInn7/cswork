Object.defineProperty(Array.prototype, 'myMap', {
  configurable: true,
  writable: true,
  value: function (callback, thisArg) {
    if (typeof callback !== 'function') throw new TypeError(callback + ' is not a function');
    const source = Object(this);
    const length = source.length >>> 0;
    const result = new Array(length);
    for (let i = 0; i < length; i++) {
      if (i in source) result[i] = callback.call(thisArg, source[i], i, source);
    }
    return result;
  },
});
