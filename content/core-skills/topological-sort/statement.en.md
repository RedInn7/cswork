# Topological Sort (Lexicographically Smallest)

There are n tasks numbered 1 to n and m constraints "u must come before v". Implement `topo_order(n, edges)`: return the **lexicographically smallest** ordering that satisfies every constraint, or an empty list if the constraints form a cycle and no ordering exists.

Use Kahn's algorithm: count each node's in-degree and put the nodes of in-degree 0 into a candidate set. Repeatedly take the **smallest-numbered** candidate, append it to the result and decrement the in-degree of every node it points to, adding those that reach 0 to the candidates. If the result ends up with fewer than n nodes, there is a cycle.

Keep the candidates in a min-heap, for O((n + m) log n) overall. A built-in priority queue is fine (`heapq`, `priority_queue`, `PriorityQueue`, `container/heap`), or reuse your min-heap from that problem. Function names follow each language's conventions (Java `topoOrder`, Go `TopoOrder`); the starter code has them.

## Input

The first line holds n and m. Each of the next m lines holds two integers u v: u must come before v (u ≠ v; a constraint may repeat).

1 ≤ n ≤ 10^4, 0 ≤ m ≤ 2×10^4.

## Output

One line: the lexicographically smallest topological order, separated by spaces, or -1 if there is a cycle.

## Explanation

The constraints are 3→1, 3→2 and 4→2. Nodes 3 and 4 start with in-degree 0; take 3, which brings 1 to 0. The candidates are now 1 and 4, so take 1, then 4, which brings 2 to 0, and finally 2. The result is 3 1 4 2.

## Hints

- A plain first-in-first-out queue also yields a valid order, but not necessarily the smallest one.
- Store the graph as adjacency lists. A repeated edge is listed twice and counted twice in the in-degree, and since the two agree nothing goes wrong.
- Detecting a cycle only takes checking whether n nodes came out.
