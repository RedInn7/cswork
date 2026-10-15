# 字典树（Trie）

实现一棵存小写单词的字典树 `Trie`，同一个单词可以插入多次（按次数计）：

| 方法 | 作用 |
| --- | --- |
| `insert(word)` | 插入 word 一次 |
| `erase(word)` | 如果 word 至少还有一次，删除一次并返回真；否则返回假 |
| `search(word)` | word 是否至少还有一次 |
| `count_prefix(p)` | 以 p 为前缀的单词有多少个（按次数计，p 本身也算以 p 为前缀） |

每个节点有 26 个孩子（数组或映射都可以），并记两个计数：`pass` 是经过这个节点的单词数，`end` 是恰好在这里结束的单词数。插入和删除沿路径修改 pass，在终点修改 end；`count_prefix` 走到 p 的末尾节点读它的 pass。每个操作都是 O(单词长度)。

不能用哈希表或集合直接存整个单词。方法名按各语言惯例书写（Java 的 `countPrefix`、Go 的 `CountPrefix`），以起始代码为准。

## 输入

第一行是操作数 q。接下来 q 行，每行一个操作：

insert w / erase w / search w / prefix p

1 ≤ q ≤ 2×10^4，单词和前缀只含小写字母，长度在 1 到 20 之间。

## 输出

`erase` 删除成功输出 1，否则输出 0；`search` 存在输出 1，否则输出 0；`prefix` 输出以 p 为前缀的单词个数。

## 样例说明

插入 apple、app、apple 之后，以 app 为前缀的有 3 个（apple 两次加 app 一次），以 apple 为前缀的有 2 个。search ap 为 0：ap 只是前缀，没有作为单词插入过。erase apple 删掉一次，apple 还剩一次，所以 search apple 仍为 1；再删两次，第二次失败。

## 提示

- erase 之前先确认单词存在，否则沿路减 pass 会把计数减成负数。
- 删除后不必真的回收节点，pass 为 0 的节点就相当于不存在。
- 节点可以用对象加指针，也可以用一个大数组：next[node][c] 存孩子的编号，0 表示没有。
