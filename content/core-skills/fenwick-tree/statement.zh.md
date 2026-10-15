# 树状数组（Fenwick Tree）

给一个长度为 n 的**非负**整数数组（下标 1 到 n），实现树状数组 `FenwickTree(values)`，支持：

| 方法 | 作用 |
| --- | --- |
| `add(i, x)` | 第 i 个元素加上 x |
| `prefix(i)` | 前 i 个元素的和（`prefix(0)` 为 0） |
| `kth(k)` | 最小的下标 j，使得前 j 个元素的和不小于 k；总和小于 k 时返回 -1 |

树状数组里 `tree[i]` 保存区间 `(i - lowbit(i), i]` 的和，`lowbit(i) = i & -i` 是 i 最低的那个二进制 1。`add` 沿 `i += lowbit(i)` 向上更新，`prefix` 沿 `i -= lowbit(i)` 向下累加，都是 O(log n)。

`kth` 不要二分套 prefix（那是 O(log² n)），而是**倍增**：从最高的 2 的幂开始往下试，`pos + step` 不越界且 `tree[pos + step] < k` 时，就把 pos 前进 step，并从 k 里减去 `tree[pos]`。最后答案是 pos + 1。这依赖于所有元素非负，前缀和单调不减。

## 输入

第一行是 n 和 q，第二行是 n 个非负整数。接下来 q 行，每行一个操作：

add i x / prefix i / kth k

1 ≤ n, q ≤ 2×10^4，初始值不超过 10^4，|x| ≤ 10^4 且任何时刻每个元素都不为负，0 ≤ i ≤ n（add 时 i ≥ 1），1 ≤ k ≤ 10^9。

## 输出

每个 prefix 输出前缀和，每个 kth 输出下标或 -1。

## 样例说明

数组是 [3, 0, 2, 5]。prefix 3 = 5。kth 4：前 3 个的和是 5 ≥ 4，前 2 个的和是 3 < 4，所以答案是 3。add 2 1 后数组变成 [3, 1, 2, 5]，kth 4 变成 2。kth 11 = 4，kth 12 超过总和 11，输出 -1。kth 1 = 1。

## 提示

- 树状数组的下标从 1 开始：lowbit(0) = 0，从 0 开始会死循环。
- 建树可以对每个元素调用一次 add，O(n log n)；也可以 O(n)：先把值放进 tree，再让每个 i 把 tree[i] 加到 tree[i + lowbit(i)] 上。
- 元素值非负时 kth 才有意义；如果有负数，前缀和不单调，就只能用别的结构了。
