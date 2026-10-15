# Union-Find (Path Compression + Union by Rank)

Implement a union-find `UnionFind(n)` over n nodes numbered 1 to n, each starting in its own set:

| Method | Does |
| --- | --- |
| `find(x)` | Return the representative (root) of x's set |
| `union(a, b)` | Merge the sets of a and b; return true if they were apart, false otherwise |
| `same(a, b)` | Whether a and b share a set |
| `size(x)` | Number of elements in x's set |
| `count()` | Current number of sets |

Each set is a tree in which `parent[x]` points to x's parent and a root points to itself. Two optimizations bring each operation's amortized cost close to constant (inverse Ackermann):

- **Path compression**: during `find`, hang the nodes passed on the way straight under the root (or every other one under its grandparent);
- **Union by rank**: when merging, hang the shorter (lower rank) or smaller tree under the other.

Method names follow each language's conventions (Go `Union`; `union` is a C++ keyword, so C++ calls it `unite`); the starter code has them.

## Input

The first line holds n and q. Each of the next q lines is one operation:

union a b / same a b / size x / count

1 ≤ n ≤ 10^5, 1 ≤ q ≤ 2×10^4, 1 ≤ a, b, x ≤ n.

## Output

`union` prints 1 if it merged two sets and 0 if they were already one; `same` prints 1 for the same set and 0 otherwise; `size` prints the set's size; `count` prints the number of sets.

## Explanation

The 5 nodes start as 5 sets. union 1 2 and union 3 4 leave 3 sets; union 2 1 finds 1 and 2 already together and prints 0. union 1 3 merges {1, 2} and {3, 4} into a set of size 4, same 2 4 is 1, and 2 sets remain.

## Hints

- Path compression without union by rank is O(log n) amortized in the worst case; only both together get near constant.
- With union by size, keep each root's set size as you merge, and size becomes O(α(n)).
- A recursive find can overflow the stack on a deep tree; a loop with "path halving" (parent[x] = parent[parent[x]]) is safer.
