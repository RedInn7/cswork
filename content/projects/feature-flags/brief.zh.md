# Feature flag 服务

做一个功能开关服务：产品可以先给 30% 的用户打开新功能，确认没问题再放到 60%、100%；也可以按国家、套餐这类属性定向打开或关闭。语言和框架不限。

## 接口

flag 的 key 由小写字母、数字和 `_ . -` 组成，以字母或数字开头，最长 64。请求和响应都是 JSON。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `PUT` | `/flags/{key}` | 请求体 `{"enabled": 布尔, "rollout": 0–100 的整数, "rules": [规则…]}`，`rules` 可省略。新建或整体替换，`version` 从 1 开始，每次 PUT 加 1。返回 200 和整个 flag，带 `ETag: "版本号"`。 |
| `GET` | `/flags/{key}` | 返回 `{"key", "enabled", "rollout", "rules", "version"}` 和 ETag。 |
| `GET` | `/flags/{key}/evaluate?user=用户ID&属性=值…` | 返回 `{"flag", "on", "reason", "version"}`。 |
| `DELETE` | `/flags/{key}` | 删除，返回 204。 |

规则的格式是 `{"attribute": "country", "in": ["US", "CA"], "serve": true}`：`attribute` 是小写字母和下划线（不能叫 `user`），`in` 是非空的字符串列表，`serve` 是命中时返回的开关值。

求值顺序：

1. `enabled` 为 false：`on` 为 false，`reason` 为 `"disabled"`。
2. 按顺序检查规则，第一条命中的（请求里这个属性的值在 `in` 里）决定结果，`reason` 为 `"rule:序号"`（从 0 开始）。
3. 都没命中就按比例放量：把 (flag key, 用户 ID) 哈希到 [0, 100) 的一个桶，桶号小于 `rollout` 就打开，`reason` 为 `"rollout"`。

放量的要求：同一个用户每次结果一样；比例要准；`rollout` 调高时，原来打开的用户必须还是打开；不同 flag 选中的用户要互相独立（所以哈希里要带 flag key）。

并发修改：PUT 带 `If-Match: "版本号"` 时，版本不一致返回 412，什么都不改。不带就直接覆盖。

错误：不存在的 flag 返回 404；evaluate 没有 `user` 返回 400；请求体不合法返回 400。

## 约束

- 求值是热路径，不能每次都读盘或遍历所有 flag。
- 写清楚你用的哈希和分桶方法，以及为什么调高比例不会把用户关掉。

## 加分项

- 客户端 SDK：本地缓存所有 flag，通过长轮询或 SSE 收到变更，服务挂了也能按最后一次配置求值。
- 审计日志：谁在什么时候把哪个 flag 从什么改成什么。
- 实验分组：把放量扩展成 A/B 多个变体，各自有比例。
- 持久化到 SQLite，重启不丢配置。
