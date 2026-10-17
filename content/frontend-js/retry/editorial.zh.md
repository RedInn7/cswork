**思路**：用 `async` 函数加循环最直观：`try { return await task(); }`，失败就在 `catch` 里判断还能不能重试。能重试就 `await` 一个 `setTimeout` 包成的 Promise，再把等待时间乘以 `factor`。

- `attempt` 从 0 开始，`attempt >= retries` 时直接 `throw error`，抛出的就是最后一次的错误。
- 一定要写 `return await task()`。只写 `return task()` 的话，拒绝不会进 `catch`，一次也不会重试。
- 等待写成 `new Promise((r) => setTimeout(r, wait))`，不要用忙等循环，那样会卡住页面。

**实际使用时还要注意**：
- 只重试临时性错误（超时、5xx），参数错误（4xx）重试也没用；
- 加一点随机抖动（jitter），免得大量客户端在同一时刻一起重试；
- 设置等待时间的上限。
