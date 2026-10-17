Implement `promisePool(tasks, limit)`: `tasks` is an array of **functions**, each returning a Promise when called. At most `limit` tasks may run at the same time.

- Start the first `limit` tasks. Whenever one finishes, start the next unstarted task **at once**; don't wait for the whole batch.
- When all are done, fulfill with the results in the order of `tasks`.
- If any task fails (its Promise rejects, or the function throws), reject with that error and **start no more** tasks.
- An empty `tasks` fulfills with `[]`. `limit` is at least 1.

```js
const upload = (name, ms) => () => new Promise((r) => setTimeout(() => r(name), ms));
await promisePool([upload('a', 30), upload('b', 10), upload('c', 10)], 2);
// ['a', 'b', 'c']; c starts at 10 ms, when b finishes
```

The tests use a fake clock.
