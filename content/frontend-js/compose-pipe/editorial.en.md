**Idea**: `pipe` is one `reduce` over the functions: start from the first function's result, and each later function takes the previous value.

```js
function pipe(...fns) {
  if (fns.length === 0) return (value) => value;
  const [first, ...rest] = fns;
  return (...args) => rest.reduce((value, f) => f(value), first(...args));
}
const compose = (...fns) => pipe(...fns.reverse());
```

- Call the first function on its own, `first(...args)`, so it can take several arguments.
- `compose` reverses the list and hands it to `pipe`. `fns` is a fresh array made by the rest parameter, so `reverse()` doesn't touch the caller's array. Reversing a shared array in place would flip the order on the second call.
- `reduceRight` writes `compose` directly, too.

Redux middleware and most "pipeline" helpers are built this way.
