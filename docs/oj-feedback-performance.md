# OJ 提交反馈优化与隔离压测

## 本轮改动

- outbox 派发周期 200ms → 50ms。保留单次 drain 合并、128 条批次上限与持久化重试。
- POST 返回原有权限过滤后的完整提交详情和 watchToken，客户端省去一次额外 GET。旧版精简回执仍兼容。
- 取消会中止旧提交详情请求，防止晚到的 running 覆盖 cancelled。
- 前台编译缓存 8 → 16 项，后台仍最多 2 项，TTL 仍为 5 分钟。每份产物已有 16MiB 上限，保留产物预算最多 288MiB（不含在途编译和运行内存）。按用户、语言、完整源码隔离，不缓存判题结果。
- 浏览器本地 Performance measure `cswork:oj:click-to-feedback`：从提交处理开始，到终态 React commit 后的绘制机会。它不是纯程序 runtime，也不是精确的显示器呈现时间。取消和后台终态不计入；不上传身份、题目或代码。

## 测量边界

`tests/oj-latency-load.mjs` 只在显式指定的本机 5053 隔离沙箱运行。它对源 SQLite 做只读在线备份，在私有临时副本及唯一测试队列内提交，最终清理自己的数据与任务。每份正确解必须通过同一个 Two Sum 完整 28 测试。

此脚本直接入队，绕过 API 的每用户配额和浏览器，因此衡量的是 **提交入库到最终结果落库**，不是用户点击到看到结果。1/5/10 指同一时刻入队的提交数，worker 仍然一次处理一个提交；使用副本中的同一账号与不同源码模拟多个编译工作集。真正跨用户缓存隔离另有单元测试。

示例（仅在已经准备好隔离沙箱、现有配置通过环境安全注入的服务器执行）：

```sh
SOURCE_DATABASE_PATH=/var/lib/cswork/cswork.sqlite \
TEST_WORKER_ENTRY=/path/to/candidate/oj-worker/index.mjs \
GO_JUDGE_URL=http://127.0.0.1:5053 \
TEST_ROUNDS=3 TEST_LANGUAGES=cpp,java,go,python \
node tests/oj-latency-load.mjs
```

冷提交给每份源码加唯一注释；warm 分组先逐份运行预热，测量时记录真实命中，不能假定 warm 一定命中。输出包含每组样本数、P50/P95、错误数、重试数、实际命中数、worker 峰值 RSS。少量突发样本的 P95 不代表线上长期分位数，更不是全题库或 LeetCode 性能保证。

真实浏览器比较还需同网络、同题、同解法、同语言，分别统计运行样例与正式提交，以及冷提交、预编译命中和重复提交。不能拿本脚本时间或结果面板 runtime 冒充用户端指标。

## 保持不变的边界

不减少测试点、不共享学员进程、不更改优化等级/JIT 或单测试资源限制。当前 2 CPU / 4GiB 沙箱和单提交 worker 并发保持不变。10 人同时冷提交仍然会排队；缓存优化不等于扩容。
