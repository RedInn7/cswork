Many older APIs take an "error-first" callback as their last argument: `callback(error, value)`, where `error` is set on failure and `null` on success.

Implement `promisify(original)`: return a new function that takes the same arguments minus the callback and returns a Promise instead:

- if the callback's `error` is truthy, reject with it;
- otherwise fulfill with `value`;
- pass the call's `this` through to `original`.

```js
function readConfig(name, callback) {
  setTimeout(() => callback(null, { name, debug: true }), 10);
}
const readConfigAsync = promisify(readConfig);
await readConfigAsync('app'); // { name: 'app', debug: true }
```
