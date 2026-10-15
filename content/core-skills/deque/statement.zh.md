# 双端队列（环形缓冲区）

用环形缓冲区实现双端队列 `RingDeque`，两端的加入和删除、按下标读取都是 O(1)（扩容摊还）。不能用语言自带的双端队列（Python 的 `collections.deque`、C++ 的 `std::deque`、Java 的 `ArrayDeque`）。

做法：一块定长数组 `data`、队头下标 `head` 和长度 `size`。第 i 个元素（从 0 开始）存在 `data[(head + i) % capacity]`。

- 初始容量为 4。加入元素时如果数组已满，先申请两倍大的数组，把元素**按队列顺序**搬到新数组的 0、1、2……位置，`head` 归零。
- `push_front` 让 `head` 向前退一格（退到 0 之前就绕回末尾），`push_back` 写到队尾之后的那一格。

需要实现的方法：

| 方法 | 作用 |
| --- | --- |
| `push_front(x)` / `push_back(x)` | 在队头 / 队尾加入 x |
| `pop_front()` / `pop_back()` | 删除并返回队头 / 队尾元素 |
| `front()` / `back()` | 返回队头 / 队尾元素 |
| `get(i)` | 返回从队头数第 i 个元素（从 0 开始） |
| `size()` | 元素个数 |

驱动只在队列非空时调用 `pop_*`、`front`、`back`；队列为空时由驱动直接输出 empty。方法名按各语言的惯例书写（如 Java 的 `pushFront`、Go 的 `PushFront`），以起始代码为准。

## 输入

第一行是操作数 q。接下来 q 行，每行一个操作：

push_front x / push_back x / pop_front / pop_back / front / back / get i / size

1 ≤ q ≤ 2×10^4，|x| ≤ 10^9，get 的下标一定在范围内。

## 输出

`pop_front`、`pop_back`、`front`、`back`、`get` 输出对应的元素，队列为空时输出 empty（get 不会遇到空队列）；`size` 输出元素个数。

## 样例说明

push_back 1、push_back 2、push_front 3 之后，队列从头到尾是 3 1 2，此时 head 已经绕到了数组末尾。get 0 是 3，get 2 是 2。push_front 4 用掉最后一个空位；push_back 5 时数组已满，扩容到 8，队列是 4 3 1 2 5。之后依次弹出，最后对空队列 pop_back 输出 empty。

## 提示

- 下标往前退时写成 (head - 1 + capacity) % capacity，避免某些语言里负数取模得到负数。
- 扩容时不能直接按 data 的物理顺序复制：队列可能从数组中间开始、绕过末尾接到开头。
- 删除元素时不必清空那一格，只要移动 head 或减小 size。
