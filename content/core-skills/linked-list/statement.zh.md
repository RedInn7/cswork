# 单链表

用节点和指针实现一个单链表 `LinkedList`，不能用语言自带的列表、数组或链表容器存元素。起始代码给出了节点结构；链表同时维护头指针 `head`、尾指针 `tail` 和长度，使 `push_back` 也是 O(1)。

需要实现的方法：

| 方法 | 作用 |
| --- | --- |
| `push_front(x)` / `push_back(x)` | 在头部 / 尾部加入 x |
| `pop_front()` | 删除并返回头节点的值（调用时链表非空） |
| `insert(i, x)` | 让 x 成为第 i 个节点（从 0 开始，`0 <= i <= size`） |
| `remove(x)` | 删除第一个值为 x 的节点，删除了返回真，没找到返回假 |
| `reverse()` | 原地反转链表（只改指针，不新建节点） |
| `size()` | 节点个数 |
| `values()` | 从头到尾的所有值，供驱动打印 |

方法名按各语言的惯例书写（如 Java 的 `pushFront`、Go 的 `PushFront`），以起始代码为准。删除尾节点、反转之后，都要记得让 `tail` 指向新的最后一个节点。

## 输入

第一行是操作数 q。接下来 q 行，每行一个操作：

push_front x / push_back x / pop_front / insert i x / remove x / reverse / size / print

数据保证 pop_front 时链表非空，insert 的下标在范围内。

1 ≤ q ≤ 2×10^4，|x| ≤ 10^9。insert、remove、reverse、print 合计不超过 200 次，print 不超过 20 次。

## 输出

`pop_front` 输出被删除的值；`remove` 删除成功输出 1，否则输出 0；`size` 输出长度；`print` 在一行内从头到尾输出所有值（以空格分隔），链表为空时输出 empty。

## 样例说明

依次加入后链表是 1 → 2 → 3，insert 1 9 得到 1 → 9 → 2 → 3。remove 2 成功，remove 7 找不到。reverse 后是 3 → 9 → 1，pop_front 删掉 3。

## 提示

- 在头部之前放一个不存值的哨兵节点，可以让 insert 和 remove 不必单独处理「改的是头节点」的情况。
- 反转时用三个指针：上一个、当前、下一个。每一步先记下 next，再把当前节点的 next 指回去。
- remove 删掉的如果是最后一个节点，tail 要退回到它的前一个节点；链表删空时 head 和 tail 都要清空。
