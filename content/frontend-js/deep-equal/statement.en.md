Implement `deepEqual(a, b)`: whether two values are structurally equal.

- Primitives compare with `===`, except that `NaN` equals `NaN`.
- Arrays: same length, and every position deeply equal.
- Plain objects: the same set of own enumerable keys (in any order), each with deeply equal values.
- `Date`: equal when the timestamps match.
- Different kinds are never equal: an array is not an object with keys `0`, `1`...; `null` is not `{}`.
- Cycles, `Map` and `Set` need no handling.

```js
deepEqual({ a: [1, 2], b: { c: 3 } }, { b: { c: 3 }, a: [1, 2] }); // true
deepEqual([1, 2], { 0: 1, 1: 2, length: 2 });                      // false
deepEqual(NaN, NaN);                                               // true
```
