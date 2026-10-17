Without the built-in `reduce`, implement `Array.prototype.myReduce(callback, initialValue)` to behave like `Array.prototype.reduce`:

- call `callback(accumulator, value, index, array)` in order; each return value becomes the next `accumulator`, and the last one is returned;
- if `initialValue` is **passed** (even as `undefined`), start from it and index 0; if it is **not passed**, the first element that isn't a hole is the starting value, and the walk starts after it;
- holes are skipped;
- an empty array (or one of only holes) with no initial value throws a `TypeError`;
- throw a `TypeError` if `callback` is not a function.

```js
[1, 2, 3].myReduce((sum, x) => sum + x);      // 6
[1, 2, 3].myReduce((sum, x) => sum + x, 10);  // 16
[].myReduce((a, b) => a + b, 'init');         // 'init'
```

During the tests the built-in `reduce` and `reduceRight` are replaced by functions that throw.
