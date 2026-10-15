# 二分查找：lower_bound 与 upper_bound

给定一个**非递减**的整数数组 a（可能有重复值），手写两个二分查找函数：

- `lower_bound(a, x)`：第一个**大于等于** x 的下标；所有元素都小于 x 时返回 n。
- `upper_bound(a, x)`：第一个**严格大于** x 的下标；所有元素都不大于 x 时返回 n。

两者之差就是 x 出现的次数。函数名按各语言惯例书写（Java 的 `lowerBound`、Go 的 `LowerBound`；C++ 为避免和标准库重名，叫 `lower_bound_index`），以起始代码为准。不能调用语言自带的二分查找（`bisect`、`std::lower_bound`、`Arrays.binarySearch`、`sort.Search` 等）。

## 输入

第一行是 n 和 q。第二行是 n 个非递减的整数。接下来 q 行，每行一个查询值 x。

1 ≤ n, q ≤ 2×10^4，所有数的绝对值不超过 10^9。

## 输出

每个查询输出一行两个整数：lower_bound 和 upper_bound（下标从 0 开始）。

## 样例说明

a = [1, 3, 3, 3, 7, 9]。查询 3：第一个 ≥ 3 的是下标 1，第一个 > 3 的是下标 4，所以 3 出现 4 - 1 = 3 次。查询 0 小于所有元素，两个答案都是 0；查询 10 大于所有元素，两个答案都是 6。查询 5 不在数组里，两个答案相同，都是 4。

## 提示

- 用左闭右开区间 [lo, hi)，初始 lo = 0、hi = n。循环条件 lo < hi，中点 mid = lo + (hi - lo) / 2。
- lower_bound：a[mid] < x 时答案在右边，lo = mid + 1；否则 hi = mid。upper_bound 只是把条件换成 a[mid] <= x。
- 循环结束时 lo == hi，就是答案。注意 hi 从 n 开始而不是 n - 1，否则「全部小于 x」的情况会返回错的下标。
