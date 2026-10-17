A search box sends a request on every keystroke, and an old request may come back **after** a newer one and overwrite its results.

Implement `latest(request)`: `request` returns a Promise (a stub in the tests; nothing goes over the network). Return a wrapper `run(...args)`:

- Every call to `run` calls `request(...args)` at once (passing `this` too) and returns a new Promise.
- When a newer call comes in, the previous call's Promise, if still unsettled, **rejects at once** with an error whose `message` is `'cancelled'`; whatever its request returns later is ignored.
- The newest call's Promise follows its own request: it fulfills or rejects as the request does.
- `run.cancel()` cancels the current unsettled call (also rejecting with `'cancelled'`).

```js
const search = latest((q) => api(`/search?q=${q}`));
search('re').catch((e) => console.log(e.message)); // 'cancelled'
search('react').then(show);                          // only react's results show
```
