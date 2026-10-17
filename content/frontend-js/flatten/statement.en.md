Implement `flatten(array, depth = 1)`: flatten nested arrays `depth` levels deep into a new array, leaving the input unchanged.

- `depth` `0` returns a shallow copy; `Infinity` flattens everything.
- Only arrays are flattened; anything else (strings and array-like objects included) stays as it is.

```js
flatten([1, [2, [3, [4]]]]);            // [1, 2, [3, [4]]]
flatten([1, [2, [3, [4]]]], 2);         // [1, 2, 3, [4]]
flatten([1, [2, [3, [4]]]], Infinity);  // [1, 2, 3, 4]
```

During the tests `Array.prototype.flat` and `flatMap` are replaced by functions that throw.
