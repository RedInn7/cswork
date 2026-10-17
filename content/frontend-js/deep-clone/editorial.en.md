**Idea**: copy recursively, with a `Map` from "original → copy" that solves two problems at once:
- cycles: when the recursion reaches an object it has seen, return that object's copy instead of recursing forever;
- shared references: each object is copied once, and every later sighting reuses that copy.

The key is to **register before recursing**: create the empty copy, call `seen.set(value, copy)`, then copy the children. In the other order, `a.self = a` recurses before `a` is in the map and overflows the stack.

- `Date`: new from the timestamp; `RegExp`: new from `source` and `flags`.
- `Map` and `Set`: a new empty container, then each entry copied recursively.
- Plain objects: `Object.create(Object.getPrototypeOf(value))` keeps the prototype.
- Functions are not copied; return the reference.

**What's wrong with `JSON.parse(JSON.stringify(x))`**: it throws on cycles, turns `Date` into strings and `Map`/`Set` into `{}`, drops `undefined` and functions, and loses prototypes.

Browsers and Node now ship `structuredClone`, which handles cycles and most built-in types, but it drops class prototypes and can't copy functions.
