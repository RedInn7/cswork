function curry(func) {
  return function collect(...args) {
    if (args.length >= func.length) return func.apply(this, args);
    return (...more) => collect.apply(this, [...args, ...more]);
  };
}
