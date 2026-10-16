# 按序执行

三个线程共用一个 `InOrder` 对象：一个线程调用 `first(job)`，一个调用 `second(job)`，一个调用 `third(job)`，每个方法恰好被调用一次。三个线程谁先启动、谁先跑到方法里，完全随机。

请让三个 `job` 严格按 first、second、third 的顺序执行，每个执行一次。等待要用阻塞原语（锁、条件变量、信号量、Event、CountDownLatch、channel 等），不要靠 `sleep` 碰运气，也不要空转循环反复检查标志。

| 方法 | 作用 |
| --- | --- |
| `first(job)` | 运行 job |
| `second(job)` | 等 first 的 job 结束后，再运行 job |
| `third(job)` | 等 second 的 job 结束后，再运行 job |

驱动会测很多轮：每轮新建一个 `InOrder`，随机打乱三个线程的启动顺序，还会在 `job` 前后随机让出 CPU 或短暂休眠，让没做同步的写法尽早暴露。判题只比较输出，所以绕开线程直接拼出答案也能通过，但那样就没有练到并发。

## 输入

第一行是随机种子 seed 和轮数 R。接下来 R 行，每行三个单词，依次是这一轮 first、second、third 的 job 要记录的单词。

1 ≤ R ≤ 100，0 ≤ seed < 2^31，单词由 1 到 8 个小写字母组成。

## 输出

每轮输出一行：这一轮三个 job 实际记录下的单词，按执行的先后顺序，以空格分隔。

## 样例说明

第一轮的三个单词是 wake、wash、work。不管哪个线程先启动，second 都要等 first 的 job 记下 wake 之后才运行自己的 job，third 要等 wash 记下之后才运行，所以这一行一定是 wake wash work。如果 job 不按顺序执行，或者有方法没有调用 job，这一行就会不同。

## 提示

- 只需要两个“已完成”的信号：second 等 first 的信号，third 等 second 的信号。
- Python 可以用 threading.Event，Java 可以用 CountDownLatch，Go 可以关闭一个 channel 来广播，C++ 可以用 mutex 加 condition_variable。
- 用条件变量时，要在 while 循环里检查条件再 wait，被唤醒后条件不一定成立。
