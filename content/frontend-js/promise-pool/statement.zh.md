实现 `promisePool(tasks, limit)`：`tasks` 是一组**函数**，每个函数调用后返回一个 Promise。同一时刻最多运行 `limit` 个任务。

- 一开始启动前 `limit` 个任务；每完成一个，**立刻**启动下一个还没开始的任务，不要等这一批全部完成。
- 全部完成后，按 `tasks` 的顺序返回结果数组。
- 任何一个任务失败（返回的 Promise 拒绝，或函数本身抛错），返回的 Promise 以这个错误拒绝，并且**不再启动**新任务。
- `tasks` 为空时兑现为 `[]`。`limit` 至少是 1。

```js
const upload = (name, ms) => () => new Promise((r) => setTimeout(() => r(name), ms));
await promisePool([upload('a', 30), upload('b', 10), upload('c', 10)], 2);
// ['a', 'b', 'c']；c 在第 10 ms（b 完成时）开始
```

测试用假时钟。
