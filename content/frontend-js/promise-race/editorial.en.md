**Idea**: a Promise settles only once. Hand the outer `resolve` and `reject` to every item; the first item to settle wins and every later call is ignored.

```js
for (const item of iterable) Promise.resolve(item).then(resolve, reject);
```

- `Promise.resolve(item)` lets plain values take part; they are already fulfilled, so they beat pending Promises.
- With an empty input neither `resolve` nor `reject` is ever called, so the Promise stays pending, which is what the spec says.

**Timeouts**: `promiseRace([request(), sleep(3000).then(() => { throw new Error('timeout'); })])`. The losing request is not cancelled; it keeps running in the background.
