# 限流模块：支持突发流量

API 网关用 `FixedWindowLimiter`（`src/limiter.py`）限制每个 API key：每分钟固定次数。付费套餐的客户反馈，批处理任务一次发 40 个请求，大部分被拒绝，尽管平均下来远没用完每分钟的额度。

在 `src/limiter.py` 里实现 `TokenBucket`，并在 `src/policy.py` 里让 `pro` 套餐改用它：

- `TokenBucket(rate, capacity, clock=None)`：每个 key 一个桶，初始是满的（`capacity` 个令牌），每秒补充 `rate` 个，最多到 `capacity`。`rate` 和 `capacity` 必须为正数，否则抛 `ValueError`。不传 clock 时用 `SystemClock`。
- `allow(key, cost=1)`：桶里至少有 `cost` 个令牌时取走并返回 `True`；否则不取，返回 `False`。`cost` 大于 `capacity` 时永远不可能成功，抛 `ValueError`。
- `retry_after(key, cost=1)`：返回还要等几秒 `allow(key, cost)` 才会成功（现在就能成功则为 `0`），不取走令牌。同样遵守上面的 `ValueError` 规则。
- 不同 key 互不影响。令牌数可以是小数。
- `limiter_for('pro')` 返回一个按套餐每分钟额度补充（每分钟 600 即每秒 10 个）、最多存 50 个令牌的桶。`free` 套餐保持固定窗口；未知套餐抛 `ValueError`。

测试里用 `src/clock.py` 的 `FakeClock` 推进时间，不要 sleep。隐藏测试会检查上面的行为，你只能看到通过了几个。
