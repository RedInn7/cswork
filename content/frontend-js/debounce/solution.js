function debounce(func, wait, options = {}) {
  const leading = Boolean(options.leading);
  const trailing = options.trailing === undefined ? true : Boolean(options.trailing);
  let timer = null;
  let pending = null; // { self, args } of a call still waiting for the trailing edge

  function debounced(...args) {
    const first = timer === null;
    clearTimeout(timer);
    if (first && leading) func.apply(this, args);
    else pending = { self: this, args };
    timer = setTimeout(() => {
      timer = null;
      const call = pending;
      pending = null;
      if (trailing && call) func.apply(call.self, call.args);
    }, wait);
  }
  debounced.cancel = () => {
    clearTimeout(timer);
    timer = null;
    pending = null;
  };
  return debounced;
}
