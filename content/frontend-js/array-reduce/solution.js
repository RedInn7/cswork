Object.defineProperty(Array.prototype, 'myReduce', {
  configurable: true,
  writable: true,
  value: function (callback, initialValue) {
    if (typeof callback !== 'function') throw new TypeError(callback + ' is not a function');
    const source = Object(this);
    const length = source.length >>> 0;
    let i = 0;
    let acc;
    if (arguments.length >= 2) acc = initialValue;
    else {
      while (i < length && !(i in source)) i++;
      if (i >= length) throw new TypeError('Reduce of empty array with no initial value');
      acc = source[i++];
    }
    for (; i < length; i++) {
      if (i in source) acc = callback(acc, source[i], i, source);
    }
    return acc;
  },
});
