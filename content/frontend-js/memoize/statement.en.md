Implement `memoize(func, resolver)`: return a caching function that computes each key once.

- The cache key is `resolver(...args)` when `resolver` is given, otherwise the **first argument**.
- The returned function has a `cache` property, a `Map` you can read, write or `clear()`.
- Cache `undefined` results too; don't compute them again.
- Pass the call's `this` to `func` (and to `resolver`).

```js
const slowSquare = (n) => { /* slow work */ return n * n; };
const fast = memoize(slowSquare);
fast(9); // computes
fast(9); // from the cache
const area = memoize((w, h) => w * h, (w, h) => `${w}x${h}`);
```
