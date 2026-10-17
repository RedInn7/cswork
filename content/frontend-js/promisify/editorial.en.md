**Idea**: inside the returned function, create a `new Promise`, append a callback after the caller's arguments, and call the original. The callback rejects on an error and resolves otherwise.

- Make the returned function a plain `function`, not an arrow, so it receives the call's `this`; pass it on with `original.call(this, ...args, callback)`. The arrow executor inside the Promise sees that same `this`.
- Decide failure by whether `error` is truthy, not by `value`, which may legitimately be `0` or `''`.

Node's `util.promisify` works the same way and also honors a custom `util.promisify.custom`.
