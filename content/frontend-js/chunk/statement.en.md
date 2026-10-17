Implement `chunk(array, size = 1)`: split an array, in order, into arrays of length `size`; the last one may be shorter. Return a new array and leave the input unchanged.

- If `size` is less than 1, return `[]`.
- A fractional `size` is rounded down.

```js
chunk([1, 2, 3, 4, 5], 2); // [[1, 2], [3, 4], [5]]
chunk(['a', 'b'], 5);      // [['a', 'b']]
chunk([1, 2], 0);          // []
```
