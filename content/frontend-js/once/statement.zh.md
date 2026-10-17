实现 `once(func)`：返回一个新函数，第一次调用时执行 `func` 并记住结果，以后的调用**不再执行** `func`，直接返回第一次的结果。

- 第一次调用的参数和 `this` 要传给 `func`。
- 第一次的结果是 `undefined` 也算已经执行过。
- `func` 抛错不算执行过：错误照常抛给调用者，下一次调用会再执行一次 `func`。

```js
const init = once(() => { console.log('init'); return 42; });
init(); // 打印 init，返回 42
init(); // 不打印，返回 42
```
