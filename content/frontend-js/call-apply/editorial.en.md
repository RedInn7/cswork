**Idea**: use the rule that in `obj.method()`, `this` is `obj`. Put the function on `thisArg` for a moment, call it as a method, then remove it.

```js
const target = thisArg == null ? globalThis : Object(thisArg);
const key = Symbol('myCall');
Object.defineProperty(target, key, { value: this, configurable: true });
try {
  return target[key](...args);
} finally {
  delete target[key];
}
```

- A `Symbol` key can't overwrite an existing property such as `fn`, and `Object.keys` doesn't list it.
- A property made with `defineProperty` is non-enumerable by default, so `this` shows no extra enumerable key during the call either.
- Deleting in `finally` cleans up even when the function throws.
- `Object(thisArg)` wraps primitives; `null` and `undefined` become `globalThis`.
- `myApply` turns the arguments into an array and hands them to `myCall`.

**Limits**: a frozen `thisArg` (`Object.freeze`) can't take the temporary property, while the built-in `call` still works. A strict-mode function receives `this` unwrapped and unreplaced, which this trick can't imitate either. Worth mentioning in an interview.
