Without the built-in `bind`, implement `Function.prototype.myBind(thisArg, ...presetArgs)`:

- return a new function `bound`; calling it calls the original with `thisArg` as `this` and `presetArgs` followed by the call's own arguments;
- when called as `new bound(...)`, ignore `thisArg` and construct like `new` on the original: the instance has the original's `prototype` on its chain (`instanceof` the original is true), and if the constructor returns an object, that object is the result;
- throw a `TypeError` when called on something that isn't a function.

You may use `apply` or `call` (or `myApply` from the previous problem).

```js
function Point(x, y) { this.x = x; this.y = y; }
const AtOrigin = Point.myBind(null, 0);
const p = new AtOrigin(5);   // Point { x: 0, y: 5 }
p instanceof Point;          // true
```

During the tests the built-in `Function.prototype.bind` is replaced by a function that throws.
