**Idea**: two variables in a closure: `called` says whether it has run, and `result` holds the answer.

- Track "has run" with its own boolean, not with `result === undefined`, or a function returning `undefined` runs every time.
- Make the returned function a plain `function` and pass `this` with `func.apply(this, args)`.
- If `func` throws, the problem lets the next call try again. So run `func` first and set `called = true` only **after it succeeds**:

```js
return function (...args) {
  if (!called) {
    result = func.apply(this, args);
    called = true;
  }
  return result;
};
```

Typical uses: initialization, a handler bound only once, guarding against a double submit.
