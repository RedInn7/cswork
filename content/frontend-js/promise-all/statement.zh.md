不用 `Promise.all`，实现 `promiseAll(iterable)`，行为与它相同：

- 参数是任意可迭代对象，元素可以是 Promise，也可以是普通值（按已兑现处理）。
- 全部兑现时，按**输入顺序**（不是完成顺序）返回结果数组。
- 任何一个拒绝，立刻以它的原因拒绝，不再等其余的。
- 空的输入立即兑现为 `[]`。

```js
const later = (value, ms) => new Promise((r) => setTimeout(() => r(value), ms));
await promiseAll([later('a', 30), later('b', 10), 'c']); // ['a', 'b', 'c']
```

测试期间 `Promise.all` 被替换成会报错的函数。
