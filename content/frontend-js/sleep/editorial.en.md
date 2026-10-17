**Idea**: wrap `setTimeout` in `new Promise` and call `resolve` when the timer fires.

```js
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
```

`resolve` is called with no arguments, so the Promise fulfills with `undefined`.

`sleep(0)` still waits for a timer task, which is later than `Promise.resolve()`: all pending microtasks run before any timer.
