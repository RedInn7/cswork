Without `Promise.race`, implement `promiseRace(iterable)`: return a Promise that follows **whichever item settles first**, fulfilling or rejecting as it does.

- Items may be plain values, treated as fulfilled.
- With an empty input, the returned Promise stays pending forever (as the built-in does).

```js
const later = (value, ms) => new Promise((r) => setTimeout(() => r(value), ms));
await promiseRace([later('slow', 50), later('fast', 10)]); // 'fast'
```

A common use is a request timeout: race the request against a Promise that rejects when time is up.

During the tests `Promise.race` is replaced by a function that throws.
