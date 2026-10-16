# 带限流的短链服务

这是很多团队用来代替电话面试、或在电话面试之后发出的那种带回家作业。预计用时三小时左右。这里没有 AI 结对：请按公司要求不使用 AI 时的方式来做。

## 需求

实现 `src/shortener.py` 里的 `Shortener` 类。`src/errors.py` 里的异常类是接口的一部分：按下面的说明抛出，不要改名。可以在 `src/` 下添加任意模块，在 `tests/` 下写自己的测试。

```python
shortener = Shortener(limit=10, window=60.0, clock=time.monotonic)
code = shortener.shorten(url, client, alias=None, ttl=None)
shortener.resolve(code)   # -> url，计一次访问
shortener.stats(code)     # -> {'url': ..., 'hits': ..., 'client': ...}
```

**URL。** `shorten` 先去掉首尾空白，然后只接受这样的 URL：协议是 `http` 或 `https`（大小写不限）、有主机名、中间没有空白字符、长度不超过 2048。其他情况（包括传入的不是字符串）都抛 `InvalidUrl`。链接保存去掉首尾空白后的 URL。

**短码和别名。** 不传 `alias` 时，短码是 7 个字符，取自 `0-9`、`A-Z`、`a-z`，并且和已经发出的所有短码、别名都不同。传了 `alias` 时，别名就是短码：3 到 30 个字符，取自 `A-Z`、`a-z`、`0-9`、`_`、`-`，否则抛 `InvalidAlias`。别名已经被用作短码（无论那条链接是否已过期）时抛 `AliasTaken`。短码区分大小写。

**同一个链接再来一次。** 普通调用（不带 `alias` 和 `ttl`）时，如果同一个客户端之前已经为同一个 URL 建过普通链接，就返回之前的短码。带别名或 ttl 的调用总是新建链接；不同客户端之间从不共用链接。

**过期。** `ttl` 是一个有限的正数，单位秒（不能是 bool），否则抛 `ValueError`。在时刻 `t` 创建、带 ttl 的链接，到 `t + ttl` 时失效：从那以后 `resolve` 和 `stats` 都抛 `NotFound`，和从未存在的短码一样。

**限流。** 每个客户端在任意 `window` 秒内最多调用 `limit` 次 `shorten`；时刻 `t` 的调用到 `t + window` 时不再计数。超出时抛 `RateLimited`，`retry_after` 是还要等多少秒才能再调用。被限流拒绝的调用不计数；其他调用都计数，包括之后因为 `InvalidUrl` 失败的调用。`resolve` 和 `stats` 不限流。

**时间。** 只从 `clock` 读时间，测试才能拨动它。

## 需要交付什么

- `src/` 里的代码，没看过需求的人也能读懂；
- `tests/` 里你自己的测试，覆盖上面的规则和你发现的边界情况；
- 在编辑器旁边的说明框里写一份简短的设计说明：怎么运行、你做了哪些假设、有哪些取舍，以及要部署到多台服务器、后面接数据库时你会改什么。

隐藏测试会检查上面的规则。运行结束后，可以请 AI 评估代码质量：结构、测试、错误处理和设计说明四项，各按 1 到 4 分打分。
