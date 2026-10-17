Implement `groupBy(array, iteratee)`: group elements by the key `iteratee` computes and return an object mapping each key to the array of its elements.

- `iteratee` is either a function (element, index → key) or a string (that property of the element).
- Keys become strings, like any object property name.
- Each group keeps the input order, and groups appear in the order their keys first show up.

```js
groupBy([6.1, 4.2, 6.3], Math.floor);   // { 6: [6.1, 6.3], 4: [4.2] }
groupBy(['one', 'two', 'three'], 'length');
// { 3: ['one', 'two'], 5: ['three'] }
```

During the tests `Object.groupBy` and `Map.groupBy` are replaced by functions that throw.
