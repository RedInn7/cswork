**思路**：先用 `Array.from` 把可迭代对象变成数组，记下总数 `left`。对每一项调用 `Promise.resolve(item)`，普通值和 thenable 都会变成 Promise。

- 兑现时按**下标** `i` 写入结果，不要 `push`，否则结果是完成顺序。
- 每兑现一个就让 `left` 减一，减到 0 时 `resolve(results)`。不能用 `results.length` 判断完成，`new Array(n)` 一开始长度就是 `n`。
- 任何一个拒绝都直接调用外层的 `reject`。Promise 只会定下一次，后面再调用 `resolve` 或 `reject` 都不起作用。
- 输入为空时不会进 `forEach`，要单独 `resolve([])`。

时间由最慢的那个决定；额外空间 O(n)。
