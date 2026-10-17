**Idea**: write out the three things `new` does:

```js
const instance = Object.create(Constructor.prototype);       // 1. a new object on the prototype
const result = Constructor.apply(instance, args);            // 2. run with it as this
return result !== null && (typeof result === 'object' || typeof result === 'function')
  ? result : instance;                                       // 3. pick the result
```

- In step 3, `typeof null === 'object'`, so rule out `null` explicitly: `return null` must be ignored.
- Returning a function counts as returning an object.
- If `Constructor.prototype` was set to a non-object, the built-in `new` falls back to `Object.prototype`; the reference solution does the same.

**Why not `class`**: a class constructor checks that it was called with `new`, so `Constructor.apply(...)` throws a `TypeError`. Supporting classes needs `Reflect.construct(Constructor, args)`, which is simply `new` as a function.
