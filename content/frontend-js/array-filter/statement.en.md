Without the built-in `filter`, implement `Array.prototype.myFilter(callback, thisArg)` to behave like `Array.prototype.filter`:

- call `callback(value, index, array)` for each element, with `this` set to `thisArg`; elements whose call returns a truthy value go into a **new array**, in order;
- holes get no call and never appear in the result;
- the range is fixed by the length at the start;
- throw a `TypeError` if `callback` is not a function;
- it must work on array-like objects too.

```js
[1, 2, 3, 4].myFilter((x) => x % 2 === 0); // [2, 4]
['a', '', 'b'].myFilter(Boolean);          // ['a', 'b']
```

During the tests the built-in `Array.prototype.filter` is replaced by a function that throws.
