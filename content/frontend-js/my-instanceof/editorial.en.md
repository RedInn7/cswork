**Idea**: `instanceof` asks whether `Constructor.prototype` appears on `value`'s prototype chain, not which constructor made `value`.

```js
for (let proto = Object.getPrototypeOf(value); proto !== null; proto = Object.getPrototypeOf(proto)) {
  if (proto === target) return true;
}
return false;
```

- Handle the edges first: throw a `TypeError` when the right side isn't a function or its `prototype` isn't an object, and return `false` for a primitive on the left. Remember `typeof null === 'object'`.
- Use `Object.getPrototypeOf`, not `__proto__`: objects from `Object.create(null)` have no `__proto__` accessor.

The last test shows how dynamic `instanceof` is: replace a constructor's `prototype` after making an instance, and that instance no longer counts.

`Symbol.hasInstance` can customize `instanceof`; the built-in checks it first, before walking the chain.
