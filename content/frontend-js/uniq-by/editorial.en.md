**Idea**: a `Set` of keys seen so far, and `filter` to keep each key's first element.

- Turn `iteratee` into a function first: a string becomes `(item) => item[iteratee]`.
- `Set` uses SameValueZero: `NaN` counts once, objects compare by reference, and `1` and `'1'` are different keys.
- Don't track keys in a plain object, which turns them into strings so `1` and `'1'` collide. Looking them up with `indexOf` is O(n²) and never finds `NaN`.

O(n) time, O(distinct keys) space.
