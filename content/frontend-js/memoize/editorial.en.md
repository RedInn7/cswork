**Idea**: keep "key → result" in a `Map` attached to the returned function (`memoized.cache`), so each memoized function has its own cache and callers can clear it.

- Check `cache.has(key)`, not `cache.get(key) !== undefined`, or an `undefined` result is computed every time.
- `Map` compares keys with SameValueZero: objects by reference, and `NaN` equals `NaN`. A plain `{}` cache turns keys into strings, so `1` and `'1'` collide, and so does every object (`'[object Object]'`).
- With several arguments, the default key is the first one, as in lodash. To key on all of them, pass a `resolver` such as `(...a) => JSON.stringify(a)`.

**Note**: the cache only grows. In long-running code, cap it (see the LRU problem), or use a `WeakMap` for object keys so they can be collected.
