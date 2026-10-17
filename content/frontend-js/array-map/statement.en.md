Without the built-in `map`, implement `Array.prototype.myMap(callback, thisArg)` to behave like `Array.prototype.map`:

- call `callback(value, index, array)` for each element, with `this` set to `thisArg`, and collect the results into a **new array**;
- holes in the array (such as the second item of `[1, , 3]`) don't get a call and stay holes in the result;
- the range is fixed by the length at the start: elements pushed by the callback aren't visited;
- throw a `TypeError` if `callback` is not a function;
- it must work on array-like objects too: `Array.prototype.myMap.call({ length: 2, 0: 'a', 1: 'b' }, f)`.

```js
[1, 2, 3].myMap((x) => x * 2);   // [2, 4, 6]
[1, , 3].myMap((x) => x * 2);    // [2, , 6]
```

During the tests the built-in `Array.prototype.map` is replaced by a function that throws.
