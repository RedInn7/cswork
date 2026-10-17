不用 `Promise.any`，实现 `promiseAny(iterable)`：

- 以**第一个兑现**的值兑现，拒绝的项先跳过。
- 全部拒绝时，以 `AggregateError` 拒绝，它的 `errors` 是所有拒绝原因，按**输入顺序**排列。
- 空输入立即以 `AggregateError` 拒绝（`errors` 为 `[]`）。
- 元素可以是普通值，按已兑现处理。

```js
await promiseAny([Promise.reject('a'), later('b', 20), later('c', 10)]); // 'c'
```

可以用 `new AggregateError(errors, message)` 创建错误。测试期间 `Promise.any` 被替换成会报错的函数。
