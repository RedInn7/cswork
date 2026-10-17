Object.defineProperty(Function.prototype, 'myBind', {
  configurable: true,
  writable: true,
  value: function (thisArg, ...presetArgs) {
    const target = this;
    if (typeof target !== 'function') throw new TypeError('myBind must be called on a function');
    function bound(...args) {
      const all = [...presetArgs, ...args];
      // Called with new: build the instance as new target(...) would.
      if (new.target) {
        const result = target.apply(this, all);
        return result !== null && (typeof result === 'object' || typeof result === 'function') ? result : this;
      }
      return target.apply(thisArg, all);
    }
    if (target.prototype) bound.prototype = Object.create(target.prototype);
    return bound;
  },
});
