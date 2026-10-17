Without `instanceof` or `isPrototypeOf`, implement `myInstanceof(value, Constructor)` with the same result as `value instanceof Constructor`:

- walk up `value`'s prototype chain; return `true` on reaching `Constructor.prototype`, and `false` at the end of the chain (`null`);
- a primitive `value` (number, string, `null`, ...) gives `false`;
- throw a `TypeError` if `Constructor` isn't a function, or its `prototype` isn't an object (an arrow function has no `prototype`).

`Symbol.hasInstance` needs no handling.

```js
myInstanceof([], Array);          // true
myInstanceof([], Object);         // true
myInstanceof('str', String);      // false: a primitive
myInstanceof(Object.create(null), Object); // false
```
