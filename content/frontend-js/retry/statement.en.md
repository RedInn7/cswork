Implement `retry(task, options)`: `task` is a function that returns a Promise. After a failure, wait and try again, multiplying the wait each time (exponential backoff).

`options`:
- `retries`: how many more tries after a failure (default `3`), so `task` is called at most `retries + 1` times;
- `delay`: ms to wait before the first retry (default `100`);
- `factor`: what the wait is multiplied by after each retry (default `2`).

The returned Promise fulfills with the first successful result; if the tries run out, it rejects with the **last** error.

```js
// Called at 0 ms and fails; retried after 100 ms, fails; again after 200 more ms...
const data = await retry(() => fetchJson('/api/feed'), { retries: 3, delay: 100 });
```

The tests use a fake clock.
