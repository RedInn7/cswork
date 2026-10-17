Implement `once(func)`: return a new function that runs `func` on its first call and remembers the result; later calls **don't run** `func` again and return that first result.

- Pass the first call's arguments and `this` to `func`.
- A first result of `undefined` still counts as having run.
- A call where `func` throws does not count: the error reaches the caller, and the next call runs `func` again.

```js
const init = once(() => { console.log('init'); return 42; });
init(); // prints init, returns 42
init(); // prints nothing, returns 42
```
