Implement `curry(func)`, which returns a curried version of `func`.

- The number of arguments needed is `func.length`.
- Each call may pass any number of arguments, which accumulate. Once there are `func.length` or more, call `func` with all of them and return its result; otherwise return a function that keeps collecting.
- A partial function can be **reused**; its uses don't affect each other.
- When `func.length` is 0, one call (with no arguments) runs it.

```js
const volume = curry((l, w, h) => l * w * h);
volume(2)(3)(4);   // 24
volume(2, 3)(4);   // 24
const base = volume(2);
base(3)(4);        // 24
base(5, 5);        // 50
```
