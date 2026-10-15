# Segment Tree: Range Sums and Point Updates

Given an integer array of length n, implement a segment tree `SegmentTree(values)` supporting:

| Method | Does |
| --- | --- |
| `update(i, x)` | Set element i to x |
| `query(l, r)` | Return the sum of elements l through r (inclusive) |

Indices in the methods are 0-based; the input's are 1-based, and the driver converts them. Both operations must run in O(log n).

Each node of a segment tree holds the sum of a range: the root covers the whole array, each child covers half of its parent, and the leaves are single elements. An update walks from a leaf up to the root; a query splits [l, r] into O(log n) whole nodes and adds them.

Either array layout works: the recursive one uses an array of size `4n` where node k's children are 2k and 2k + 1; the iterative one uses size `2n`, with the leaves at `n .. 2n - 1` and node k's parent at k / 2.

## Input

The first line holds n and q, the second the n integers. Each of the next q lines is one operation:

set i x / sum l r

1 ≤ n, q ≤ 2×10^4, 1 ≤ i ≤ n, 1 ≤ l ≤ r ≤ n, and every number's absolute value is at most 10^9.

## Output

For each sum, one line with the range sum.

## Explanation

The array is [5, -2, 7, 1, 3]. sum 1 3 = 5 - 2 + 7 = 10. After set 2 4 the array is [5, 4, 7, 1, 3], so sum 1 3 = 16, sum 2 5 = 15 and sum 4 4 = 1.

## Hints

- Sums can reach 2×10^4 × 10^9 = 2×10^13, beyond 32 bits: use 64-bit integers.
- The iterative query: l += n and r += n + 1; then while l < r, if l is a right child take tree[l] and l++, if r is a right child r-- and take tree[r], and halve both.
- If the array never changed, prefix sums would do; a segment tree earns its keep by making both updates and queries O(log n).
