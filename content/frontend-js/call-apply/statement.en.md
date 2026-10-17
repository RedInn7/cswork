Without `call`, `apply`, `bind` or `Reflect.apply`, implement two methods:

- `Function.prototype.myCall(thisArg, ...args)`: call the function with `thisArg` as `this` and the arguments one by one;
- `Function.prototype.myApply(thisArg, argsArray)`: the same, with the arguments in an array (or array-like); when `argsArray` is `null` or `undefined`, pass no arguments.

Requirements:
- return the function's return value;
- when `thisArg` is `null` or `undefined`, `this` is the global object `globalThis` (sloppy-mode behavior); primitives are wrapped in objects (`'abc'` → a `String` object);
- after the call, `thisArg` must not have gained any property.

```js
function greet(greeting, mark) { return `${greeting}, ${this.name}${mark}`; }
greet.myCall({ name: 'Ada' }, 'Hi', '!');      // 'Hi, Ada!'
greet.myApply({ name: 'Lin' }, ['Hello', '.']); // 'Hello, Lin.'
```
