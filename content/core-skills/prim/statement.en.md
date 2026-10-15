# Prim's Minimum Spanning Tree (Dense Graphs)

An undirected weighted graph on n nodes comes as an **adjacency matrix**: `w[i][j]` is the weight of the edge between i and j, -1 means no edge, and the diagonal is 0. Implement `prim(n, w)`: find a minimum spanning tree with the O(n²) version of Prim's algorithm and return the **order in which the nodes join the tree**. Inside the function nodes are numbered from 0 (`w` is a 0-based n × n array too); the driver adds 1 when printing.

Prim's algorithm starts from node 1 (node 0 inside the function) and keeps, for every node outside the tree, a `key`: the weight of the lightest edge between it and the tree (infinity if none). Each step adds the outside node with the smallest key (**the smaller number on ties**), then uses its edges to update the remaining keys. If every remaining key is infinite, the graph is disconnected; stop there.

A dense graph needs no heap: each step scans every node for the smallest key, n steps in all, exactly O(n²), on par with reading the matrix. The driver totals the weights from the returned order and prints -1 when fewer than n nodes come back. Function names follow each language's conventions (Go `Prim`); the starter code has them.

## Input

The first line is n. Each of the next n lines holds n integers; the j-th on line i is w[i][j]. The matrix is symmetric with w[i][i] = 0, and every other entry is -1 or a weight from 1 to 1000.

1 ≤ n ≤ 200.

## Output

For a connected graph, two lines: the minimum spanning tree's total weight, then the order the nodes joined (separated by spaces, starting with 1). For a disconnected graph, only -1.

## Explanation

From 1, the keys are 2 for node 2, 6 for node 3 and 5 for node 4. Node 2 joins and lowers node 3's key to 3. Node 3 joins (key 3) and lowers node 4's key to 1. Node 4 joins last. The total is 2 + 3 + 1 = 6 and the order 1 2 3 4.

## Hints

- Mark tree membership in a boolean array; keys start at infinity, with key[1] = 0.
- "The smaller number on ties" means the scan replaces its minimum only on a strictly smaller key.
- On sparse graphs a heap with adjacency lists gives O(m log n); on dense ones m is near n², and the O(n²) version wins.
