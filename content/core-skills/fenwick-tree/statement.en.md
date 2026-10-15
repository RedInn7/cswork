# Fenwick Tree (Binary Indexed Tree)

Given an array of n **non-negative** integers (indices 1 to n), implement a Fenwick tree `FenwickTree(values)` supporting:

| Method | Does |
| --- | --- |
| `add(i, x)` | Add x to element i |
| `prefix(i)` | The sum of the first i elements (`prefix(0)` is 0) |
| `kth(k)` | The smallest index j whose first j elements sum to at least k, or -1 if the total is below k |

In a Fenwick tree, `tree[i]` holds the sum of the range `(i - lowbit(i), i]`, where `lowbit(i) = i & -i` is i's lowest set bit. `add` climbs with `i += lowbit(i)` and `prefix` descends with `i -= lowbit(i)`, both O(log n).

Do not answer `kth` with a binary search over prefix (that is O(log² n)); use **binary lifting** instead: try steps from the highest power of two down, and whenever `pos + step` is in range and `tree[pos + step] < k`, advance pos by step and subtract `tree[pos]` from k. The answer is pos + 1. This relies on every element being non-negative, so prefix sums never decrease.

## Input

The first line holds n and q, the second the n non-negative integers. Each of the next q lines is one operation:

add i x / prefix i / kth k

1 ≤ n, q ≤ 2×10^4, initial values are at most 10^4, |x| ≤ 10^4 and no element ever goes negative, 0 ≤ i ≤ n (i ≥ 1 for add), 1 ≤ k ≤ 10^9.

## Output

Each prefix prints the prefix sum and each kth prints the index or -1.

## Explanation

The array is [3, 0, 2, 5]. prefix 3 = 5. For kth 4, the first 3 elements sum to 5 ≥ 4 while the first 2 sum to 3 < 4, so the answer is 3. After add 2 1 the array is [3, 1, 2, 5] and kth 4 becomes 2. kth 11 = 4, kth 12 exceeds the total of 11 and prints -1, and kth 1 = 1.

## Hints

- Fenwick indices start at 1: lowbit(0) = 0, and starting from 0 loops forever.
- Building can call add once per element, O(n log n), or take O(n): put the values into tree, then let each i add tree[i] into tree[i + lowbit(i)].
- kth only makes sense for non-negative elements; with negatives, prefix sums are not monotonic and another structure is needed.
