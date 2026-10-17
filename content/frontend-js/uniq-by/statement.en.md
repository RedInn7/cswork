Implement `uniqBy(array, iteratee)`: drop duplicates by the key `iteratee` computes, keeping the **first** element for each key, in the original order.

- `iteratee` is either a function (element → key) or a string (that property of the element is the key).
- Keys compare as in a `Set`: `NaN` equals `NaN`, objects by reference.
- Return a new array and leave the input unchanged.

```js
uniqBy([2.1, 1.2, 2.3], Math.floor);              // [2.1, 1.2]
uniqBy([{ id: 1 }, { id: 2 }, { id: 1 }], 'id');  // [{ id: 1 }, { id: 2 }]
```
