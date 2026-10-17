function once(func) {
  let called = false;
  let result;
  return function (...args) {
    if (!called) {
      result = func.apply(this, args);
      called = true;
    }
    return result;
  };
}
