实现 `retry(task, options)`：`task` 是返回 Promise 的函数。失败后等一段时间再试，每次等待的时间按倍数增长（指数退避）。

`options`：
- `retries`：失败后最多再试几次（默认 `3`），总共最多调用 `retries + 1` 次；
- `delay`：第一次重试前等待的毫秒数（默认 `100`）；
- `factor`：每次重试后等待时间乘的倍数（默认 `2`）。

返回的 Promise 以第一次成功的结果兑现；次数用完仍失败，就以**最后一次**的错误拒绝。

```js
// 第 0 ms 调用，失败；等 100 ms 重试，失败；再等 200 ms 重试……
const data = await retry(() => fetchJson('/api/feed'), { retries: 3, delay: 100 });
```

测试用假时钟。
