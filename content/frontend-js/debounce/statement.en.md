Implement `debounce(func, wait, options)`, which returns a debounced version of `func`.

Calls less than `wait` ms apart belong to the same burst. Every call restarts the clock, and the burst ends once `wait` ms pass without another call.

- `options.trailing` (default `true`): when the burst ends, call `func` once with the **last** call's arguments and `this`.
- `options.leading` (default `false`): call `func` right away on the **first** call of a burst.
- With both `true`: a burst of one call runs `func` once; a burst of several runs it at the start and at the end.
- The returned function has a `cancel()` method that drops the pending call; the next call starts a new burst.

```js
const save = debounce((text) => console.log('save', text), 300);
save('h'); save('he'); save('hello');
// 300 ms after the last call, this prints once: save hello
```

The tests use a fake clock: they control `setTimeout`, `clearTimeout` and `Date.now()`, so nothing really waits.
