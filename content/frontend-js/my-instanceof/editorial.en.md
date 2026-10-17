**Idea**: `instanceof` asks whether `Constructor.prototype` appears on `value`'s prototype chain, not which constructor made `value`.

```js
for (let proto = Object.getPrototypeOf(value); proto !== null; proto = Object.getPrototypeOf(proto)) {
  if (proto === target) return true;
}
return false;
```

- Handle the edges first, in the built-in's order: throw a `TypeError` when the right side isn't a function; return `false` for a primitive on the left; only then read `prototype` and throw if it isn't an object. So `1 instanceof (() => {})` is `false`, not an error. Remember `typeof null === 'object'`.
- Use `Object.getPrototypeOf`, not `__proto__`: objects from `Object.create(null)` have no `__proto__` accessor.

The last test shows how dynamic `instanceof` is: replace a constructor's `prototype` after making an instance, and that instance no longer counts.

`Symbol.hasInstance` can customize `instanceof`; the built-in checks it first, before walking the chain.
