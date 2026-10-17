Without `Promise.all`, implement `promiseAll(iterable)` with the same behavior:

- The argument is any iterable; items may be Promises or plain values (treated as fulfilled).
- When all fulfill, it fulfills with the results in **input order** (not finishing order).
- As soon as one rejects, it rejects with that reason without waiting for the rest.
- An empty input fulfills with `[]` right away.

```js
const later = (value, ms) => new Promise((r) => setTimeout(() => r(value), ms));
await promiseAll([later('a', 30), later('b', 10), 'c']); // ['a', 'b', 'c']
```

During the tests `Promise.all` is replaced by a function that throws.
