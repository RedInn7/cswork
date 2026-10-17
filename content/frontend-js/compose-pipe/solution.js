function pipe(...fns) {
  if (fns.length === 0) return (value) => value;
  const [first, ...rest] = fns;
  return (...args) => rest.reduce((value, f) => f(value), first(...args));
}

function compose(...fns) {
  return pipe(...fns.reverse());
}
