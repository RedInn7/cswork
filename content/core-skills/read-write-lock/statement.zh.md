# 读写锁

实现读写锁 `RWLock`：

- 读锁可以被多个线程同时持有，前提是没有线程持有写锁。
- 写锁是独占的：持有写锁时，其他线程既不能读也不能写。
- 拿不到锁的线程要阻塞等待，直到条件满足；不要用 `sleep` 或空转循环。

请用互斥锁加条件变量自己实现，不要直接用现成的读写锁：Java 的 `ReentrantReadWriteLock`、`StampedLock`，Go 的 `sync.RWMutex`，C++ 的 `std::shared_mutex` 都不行。是否让等待中的写者优先，由你决定，判题不检查。

| 方法 | 作用 |
| --- | --- |
| `acquire_read()` | 获取读锁：等到没有写者持有锁 |
| `release_read()` | 释放读锁 |
| `acquire_write()` | 获取写锁：等到既没有读者也没有写者 |
| `release_write()` | 释放写锁 |

Java 和 Go 里方法名是驼峰形式（`acquireRead`、`AcquireRead` 等）。每轮新建一个 `RWLock`，有三种轮次：

- `mix`：若干读者和写者线程并发访问一份数据。写者把自己的值分两步加到两个变量上，中间会停一下；读者分两次读这两个变量，看到不相等就说明读到了写了一半的数据。驱动还会直接统计锁内的读者和写者人数。
- `share`：只有读者。每个读者拿到读锁后，要等所有读者都拿到读锁才释放。读锁不能共享（比如直接用一把普通互斥锁）时，这一轮会超时失败。
- `hold`：驱动自己先拿写锁，再启动一个读者和一个写者去抢，0.1 秒内谁都不能进来；然后驱动拿读锁，再让一个写者去抢，同样不能进来。

判题只比较输出，所以绕开线程直接拼出答案也能通过，但那样就没有练到并发。

## 输入

第一行是随机种子 seed 和轮数 R。接下来 R 行，每行一轮，是以下三种之一：

mix r w ops v1 … vw：r 个读者、w 个写者，每人做 ops 次操作；第 i 个写者每次把 vi 加到数据上。

share n：n 个读者同时持有读锁。

hold：驱动持锁时，其他线程要被挡在外面。

1 ≤ R ≤ 100，mix 轮里 r + w ≤ 8、1 ≤ ops ≤ 12、1 ≤ vi ≤ 9，share 轮里 2 ≤ n ≤ 8，0 ≤ seed < 2^31。

## 输出

每轮顺利结束时输出一行：mix 轮输出数据的最终值，share 轮输出 n，hold 轮输出 held。

驱动一旦发现问题，就在已经输出的行后面再输出一行 round k: 加上问题描述，然后立即结束。问题包括：a reader got in while a writer held the lock、a writer got in while another thread held the lock、a reader saw a half-done write (a and b)、n readers could not hold the read lock at the same time、a thread got in while the write lock was held、a writer got in while a read lock was held。

## 样例说明

第三轮有 2 个读者和 2 个写者，每人 3 次操作，两个写者的值是 4 和 5，所以数据最终是 3 × (4 + 5) = 27。只要写者之间、写者与读者之间正确互斥，读者就不会看到写了一半的数据。

## 提示

- 用一把互斥锁保护几个计数：持有读锁的读者数、是否有写者在写。读者等“没有写者”，写者等“没有读者也没有写者”。
- 最后一个读者释放读锁、或者写者释放写锁时，用 notify_all（signalAll、Broadcast）唤醒等待者，因为可能有一批读者可以一起进入。
- 读者源源不断时，写者可能一直等不到。记录“等待中的写者”数量，让新来的读者等写者先走，就能避免写者饿死。
