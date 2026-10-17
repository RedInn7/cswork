# 带重试和可见性超时的任务队列

做一个类似 SQS 的任务队列服务：生产者放进消息，消费者取出来处理，处理完确认（ack）。消费者中途崩溃时，消息过了可见性超时会自动回到队列重试；重试太多次就进死信。语言和框架不限。

## 接口

请求和响应都是 JSON。队列名由字母、数字、`_`、`-` 组成，长度 1–64，第一次用到时自动创建。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/queues/{q}/messages` | `{"body": 任意 JSON, "max_attempts": 1–20（默认 3）, "delay_ms": ≥ 0（默认 0）}`，返回 201 `{"id"}`。`delay_ms` 内消息不可见。 |
| `POST` | `/queues/{q}/receive` | `{"visibility_ms": 1–3600000（默认 30000）, "max": 1–10（默认 1）}`，返回 200 `{"messages": [{"id", "body", "receipt", "attempt"}]}`，没有就是空列表。取出的消息在 `visibility_ms` 内对别人不可见，`attempt` 是第几次投递（从 1 开始）。 |
| `POST` | `/queues/{q}/ack` | `{"receipt"}`，确认处理完，删除消息，返回 204。 |
| `POST` | `/queues/{q}/nack` | `{"receipt", "delay_ms": 可选}`，处理失败，马上（或延迟后）重新可见，返回 204。 |
| `GET` | `/queues/{q}/stats` | `{"ready", "delayed", "in_flight", "dead"}`。 |
| `GET` | `/queues/{q}/dead` | `{"messages": [{"id", "body", "attempts"}]}`，按入队顺序。 |

规则：

- 先进先出：按入队顺序投递可见的消息。
- receipt 只代表某一次投递。超时后、被再次投递后、已经 ack 过的 receipt，以及根本不存在的 receipt，ack 和 nack 都返回 409。
- 一条消息已经投递了 `max_attempts` 次，这次又超时或被 nack，就进死信，不再投递。
- 参数缺失或越界、请求体不是 JSON，返回 400。

## 约束

- 多个消费者同时 receive，同一条消息在可见期内只能给一个人。
- 不要为了等超时开一堆定时器线程，说明你怎么找到已经超时的消息。

## 加分项

- 持久化：用 SQLite 或追加日志，重启后消息不丢，在途消息的超时继续算。
- 长轮询：receive 带 `wait_ms`，队列空时等消息来再返回。
- 死信重放：把死信里的消息放回原队列。
- 写一个 worker 库，带指数退避重试和处理超时后自动续期（延长可见性）。
