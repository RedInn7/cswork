# Kruskal's Minimum Spanning Tree

A weighted graph has n nodes and m **undirected edges**, numbered 1 to m in input order. Implement `kruskal(n, edges)`: find a minimum spanning tree with Kruskal's algorithm and return the chosen edges' indices (0-based) **in the order they were chosen**.

Kruskal's algorithm: sort the edges by weight ascending (**equal weights in input order**) and consider each in turn. If its two endpoints are in different components, choose it and merge the components; otherwise skip it, since it would close a cycle. A union-find structure answers "same component?".

The driver totals the weights of the returned edges; fewer than n - 1 chosen edges means the graph is disconnected and it prints -1. A built-in sort is fine. Function names follow each language's conventions (Go `Kruskal`); the starter code has them.

## Input

The first line holds n and m. Each of the next m lines holds three integers u v w: an undirected edge between u and v of weight w (parallel edges and self-loops may occur).

1 ≤ n ≤ 10^4, 0 ≤ m ≤ 2×10^4, 1 ≤ w ≤ 10^6.

## Output

For a connected graph, two lines: the minimum spanning tree's total weight, then the chosen edge numbers (1-based, in the order chosen, separated by spaces; empty when n = 1). For a disconnected graph, only -1.

## Explanation

Sorted by weight, the edges are: edge 3 (weight 1), edges 2 and 5 (both weight 2, edge 2 first by input order), edge 1 (3) and edge 4 (4). Edge 3 joins 1 and 3; edge 2 joins 2 and 3; edge 5 joins 1 and 2, already connected, so it is skipped; edge 1 joins 3 and 4. That makes 3 edges of total weight 1 + 2 + 3 = 6.

## Hints

- A union-find with path compression and union by rank (or size) makes each operation nearly constant time; the O(m log m) sort dominates.
- Carry each edge's index through the sort, or sort an array of indices, so the original numbers can be returned.
- Stop once n - 1 edges are chosen.
