function throttle(func, wait) {
  let timer = null;
  let kept = null; // { self, args } of the last call inside the window

  function openWindow() {
    timer = setTimeout(() => {
      if (!kept) {
        timer = null;
        return;
      }
      const call = kept;
      kept = null;
      func.apply(call.self, call.args);
      openWindow();
    }, wait);
  }
  function throttled(...args) {
    if (timer === null) {
      func.apply(this, args);
      openWindow();
    } else kept = { self: this, args };
  }
  throttled.cancel = () => {
    clearTimeout(timer);
    timer = null;
    kept = null;
  };
  return throttled;
}
