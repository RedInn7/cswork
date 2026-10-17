实现 `memoize(func, resolver)`：返回一个带缓存的函数，相同的键只计算一次。

- 缓存的键：传了 `resolver` 就用 `resolver(...args)` 的返回值，否则用**第一个参数**。
- 返回的函数有一个 `cache` 属性，是一个 `Map`，可以直接读写或 `clear()`。
- 结果是 `undefined` 也要缓存，不能重复计算。
- 调用时的 `this` 要传给 `func`（和 `resolver`）。

```js
const slowSquare = (n) => { /* 很慢的计算 */ return n * n; };
const fast = memoize(slowSquare);
fast(9); // 计算
fast(9); // 直接读缓存
const area = memoize((w, h) => w * h, (w, h) => `${w}x${h}`);
```
