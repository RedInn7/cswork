Implement `throttle(func, wait)`, which returns a throttled version of `func`: however often it is called, `func` runs at most once every `wait` ms.

- The first call while idle runs **at once** and opens a cooldown window of `wait` ms.
- Calls inside the window don't run; only the **last** one's arguments and `this` are kept. When the window ends, `func` runs once with them and a new window opens right away.
- If nothing was kept when a window ends, the throttle goes idle, and the next call runs at once again.
- The returned function has a `cancel()` method that drops the kept call and goes idle.

```js
const onScroll = throttle((y) => console.log(y), 100);
onScroll(10);  // prints 10 now
onScroll(20);  // kept
onScroll(30);  // replaces it with 30
// prints 30 at 100 ms
```

The tests use a fake clock: they control `setTimeout`, `clearTimeout` and `Date.now()`.
