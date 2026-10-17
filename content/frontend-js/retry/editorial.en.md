**Idea**: an `async` function with a loop reads most plainly: `try { return await task(); }`, and in `catch` decide whether another try is allowed. If so, `await` a Promise around `setTimeout`, then multiply the wait by `factor`.

- `attempt` starts at 0. When `attempt >= retries`, `throw error`: that is the last error.
- Write `return await task()`. A bare `return task()` skips the `catch` on rejection, so it never retries.
- Wait with `new Promise((r) => setTimeout(r, wait))`, never with a busy loop, which would freeze the page.

**In real code, also**:
- retry only transient errors (timeouts, 5xx); a bad request (4xx) fails the same way every time;
- add random jitter, so many clients don't all retry at the same moment;
- cap the wait.
