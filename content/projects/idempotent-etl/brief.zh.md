# 幂等的 ETL 管道（命令行）

写一个命令行程序，把一个目录里的订单 CSV 导入 SQLite，并算出每日汇总。重点是幂等：同样的输入跑多少次结果都一样；中途被杀掉，数据库要么是上次的样子，要么是这次跑完的样子，不会只写了一半。语言不限，只要能写 SQLite。

## 用法

```
你的程序 --input 目录 --db 文件.sqlite
```

按文件名排序读取目录里所有 `*.csv`。全部处理完退出码为 0（有被拒绝的行也是 0）；目录不存在时退出码非 0。

## 输入

UTF-8 的 CSV（可能带 BOM），第一行是表头，必须正好是 `order_id,customer,amount,currency,status,updated_at`（顺序固定，两边空格忽略）。字段可以用双引号括起来，里面可能有逗号和转义的引号。每个字段先去掉两边空格再校验：

| 字段 | 规则 |
| --- | --- |
| `order_id` | 1–40 个字母、数字或 `-` |
| `customer` | 非空，最多 200 个字符 |
| `amount` | 非负，最多两位小数，如 `12`、`0.5`、`19.99`；存成整数分 `amount_cents` |
| `currency` | 转大写后是 3 个字母 |
| `status` | 转小写后是 `created`、`paid`、`shipped`、`cancelled` 之一 |
| `updated_at` | 合法的 UTC 时间，格式严格为 `YYYY-MM-DDTHH:MM:SSZ` |

列数不对或任何一个字段不合法，这一行就进 `rejects`；表头不对，整个文件只记一条 `rejects`（行号 1），然后跳过。

## 输出（表结构固定）

```sql
CREATE TABLE orders(order_id TEXT PRIMARY KEY, customer TEXT NOT NULL, amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL, status TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE rejects(file TEXT NOT NULL, line INTEGER NOT NULL, reason TEXT NOT NULL, PRIMARY KEY(file, line));
CREATE TABLE daily_totals(day TEXT NOT NULL, currency TEXT NOT NULL, orders INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL, PRIMARY KEY(day, currency));
```

- `orders`：同一个 `order_id` 只保留 `updated_at` 最新的一行。新来的行只有在 `updated_at` 严格更新时才覆盖，相等或更旧都不动。
- `rejects`：`file` 是文件名（不含目录），`line` 是 CSV 里的行号（表头是第 1 行），`reason` 自己写。重跑不能产生重复。
- `daily_totals`：按 `updated_at` 的日期（前 10 个字符）和币种汇总，不算 `cancelled` 的订单。每次运行后都要和 `orders` 一致。

## 约束

- 幂等：输入不变时，重跑后三张表完全相同。
- 原子：一次运行要么全部生效，要么完全不生效。被 `kill -9` 之后再跑一次，结果和没被打断一样。
- 15 万行的文件要能在几秒内处理完。

## 加分项

- 记录每个文件的哈希，没变的文件直接跳过，并说明这样做对「迟到的旧文件」是否还正确。
- 支持输入来自 S3 或 HTTP，失败时有限次重试。
- 输出运行指标：读了多少行、更新多少、拒绝多少、耗时。
- 用 Airflow 或 cron 调度，并说明重复调度时为什么安全。
