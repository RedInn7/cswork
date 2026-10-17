# Mini Redis（RESP 协议子集）

实现一个说 Redis 协议（RESP2）的内存数据库服务器，能直接用 `redis-cli` 连上。只做字符串类型和过期，但协议解析、管道（pipelining）、并发客户端都要做对。不能包装现成的 Redis 或 Redis 库。语言不限。

## 协议

客户端发来的每条命令是一个由 bulk string 组成的数组：`*参数个数\r\n`，然后每个参数是 `$字节数\r\n内容\r\n`。回复的五种类型：

- 简单字符串 `+OK\r\n`
- 错误 `-ERR 说明\r\n`
- 整数 `:42\r\n`
- bulk string `$5\r\nhello\r\n`；不存在时是 `$-1\r\n`（nil）
- 数组（本项目用不到）

值是二进制安全的：里面可以有 `\r\n` 和 `\0`，长度以 `$` 后面的字节数为准，最大至少支持 1 MB。

## 命令

命令名不区分大小写。

| 命令 | 回复 |
| --- | --- |
| `PING [msg]` | 没参数回 `+PONG`，有参数原样回 bulk string |
| `ECHO msg` | bulk string |
| `SET key value [EX 秒 \| PX 毫秒] [NX \| XX]` | `+OK`；带 NX 而 key 已存在、或带 XX 而 key 不存在时，不写入，回 nil。不带过期参数的 SET 会清掉原来的过期时间。 |
| `GET key` | bulk string 或 nil |
| `DEL key [key …]` | 删掉了几个（整数） |
| `EXISTS key [key …]` | 存在几个，重复的 key 重复计数 |
| `INCR key` | 加 1 后的值；不存在按 0 算；值不是 64 位有符号整数，或加了会溢出，回错误 |
| `EXPIRE key 秒` | 设置成功回 1，key 不存在回 0 |
| `TTL key` | 剩余秒数（四舍五入）；没有过期时间回 -1；不存在回 -2 |

未知命令、参数个数不对、选项不合法：回一行 `-ERR …`，连接保持可用。

## 约束

- 一次 `send` 里可能有很多条命令（pipelining），回复必须按顺序；一条命令也可能分好几次到达，要等收齐再执行。
- 多个客户端同时连接，`INCR` 不能丢更新。
- 过期的 key 在 GET、EXISTS、TTL 时都要表现为不存在。

## 加分项

- 定期抽样删除过期 key（Redis 的做法），而不是只在访问时检查。
- 持久化：AOF 追加日志或 RDB 快照，重启恢复。
- 加 List 或 Hash 类型，以及 `KEYS pattern`。
- 用 `redis-benchmark` 压测，和真 Redis 对比，解释差距。
