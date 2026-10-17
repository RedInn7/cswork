**Idea**: one pass. Compute each element's key (as a string), create an empty array for a new group, then `push`.

- A string `iteratee` becomes a property getter; a function also gets the index.
- Check whether a group exists with `hasOwnProperty`, not `if (!groups[key])`. A key may be `toString` or `constructor`; a plain object inherits those methods, so `groups['toString']` is a function and `push` throws.
- Another way is a prototype-less object from `Object.create(null)`, which is what the built-in `Object.groupBy` returns.

O(n) time. For keys that aren't strings (objects, say), group into a `Map` instead.
