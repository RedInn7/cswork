**Idea**: the classic pre-ES5 trick. Borrow an empty constructor, set its `prototype` to `proto`, and `new` gives an object whose prototype is `proto`.

```js
function Empty() {}
Empty.prototype = proto;
object = new Empty();
```

- This fails for `proto === null`: when `prototype` isn't an object, `new` falls back to `Object.prototype`. Use `Object.setPrototypeOf({}, null)` there.
- Check the argument first: accept objects, functions or `null`, and throw a `TypeError` otherwise.
- The second argument holds property descriptors; hand it to `Object.defineProperties`. Missing `enumerable`, `writable` and `configurable` default to `false`, which is why `hidden` doesn't show in `Object.keys` in the tests and `x` can't be overwritten.

`objectCreate(null)` makes a "pure dictionary": no inherited `toString` or `constructor` keys, so `key in dict` isn't fooled by the prototype.
