**Idea**: a collector `collect(...args)` that can call itself:
- with enough arguments (`args.length >= func.length`), call `func`;
- otherwise return a new function that appends its arguments to the old ones and hands them back to `collect`.

```js
function curry(func) {
  return function collect(...args) {
    if (args.length >= func.length) return func.apply(this, args);
    return (...more) => collect.apply(this, [...args, ...more]);
  };
}
```

- Build a **new array** with `[...args, ...more]` every time. Pushing into one shared array breaks a partial like `plus10` after its first use.
- `func.length` skips parameters with defaults and rest parameters: `(a, b = 1) => …` has `length` 1.

Going further: lodash's `curry` also takes a placeholder `_` to fix later arguments first.
