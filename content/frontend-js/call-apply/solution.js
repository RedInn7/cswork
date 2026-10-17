Object.defineProperty(Function.prototype, 'myCall', {
  configurable: true,
  writable: true,
  value: function (thisArg, ...args) {
    if (typeof this !== 'function') throw new TypeError('myCall must be called on a function');
    const target = thisArg === null || thisArg === undefined ? globalThis : Object(thisArg);
    // A fresh symbol can't clash with the object's own keys.
    const key = Symbol('myCall');
    Object.defineProperty(target, key, { value: this, configurable: true });
    try {
      return target[key](...args);
    } finally {
      delete target[key];
    }
  },
});

Object.defineProperty(Function.prototype, 'myApply', {
  configurable: true,
  writable: true,
  value: function (thisArg, argsArray) {
    const args = argsArray === null || argsArray === undefined ? [] : Array.from(argsArray);
    return this.myCall(thisArg, ...args);
  },
});
