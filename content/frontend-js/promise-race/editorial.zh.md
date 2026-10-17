**思路**：Promise 只能定下来一次。把外层的 `resolve` 和 `reject` 同时挂到每一项上，最先定下来的那一项生效，后面的调用都被忽略。

```js
for (const item of iterable) Promise.resolve(item).then(resolve, reject);
```

- `Promise.resolve(item)` 让普通值也能参与；它是「已经兑现」的，所以会赢过还在等待的 Promise。
- 空输入时一次也不调用 `resolve` 或 `reject`，Promise 就一直等待，这正是规范的行为。

**超时的写法**：`promiseRace([request(), sleep(3000).then(() => { throw new Error('timeout'); })])`。注意赛跑输了的请求并不会被取消，它仍在后台进行。
