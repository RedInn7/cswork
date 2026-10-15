# Dijkstra's Shortest Paths

A graph has n nodes and m **directed edges** with non-negative weights. Implement `dijkstra(n, edges, s)`: return the shortest distance from the source s to every node, with -1 for nodes it cannot reach.

Dijkstra's algorithm: the source starts at distance 0 and every other node at infinity. Repeatedly take the unsettled node with the **smallest distance**; its distance is now final, and its outgoing edges update (relax) its neighbours' distances. Non-negative weights guarantee the current minimum can never improve later.

Keep (distance, node) pairs in a min-heap. When a node's distance drops, push the new pair and leave the old one in the heap; a popped pair whose distance exceeds the recorded one is stale and skipped ("lazy deletion"). The total is O((n + m) log m). A built-in priority queue is fine. Function names follow each language's conventions (Go `Dijkstra`); the starter code has them.

## Input

The first line holds n, m and s. Each of the next m lines holds three integers u v w: a directed edge from u to v of weight w (parallel edges and self-loops may occur).

1 ≤ n ≤ 10^4, 0 ≤ m ≤ 2×10^4, 1 ≤ s ≤ n, 0 ≤ w ≤ 10^6.

## Output

One line of n integers: the shortest distances from s to nodes 1, 2, …, n, or -1 for unreachable ones.

## Explanation

From 1, the direct edge 1→2 costs 4 but 1→3→2 costs only 1 + 2 = 3. Then 1→3→2→4 costs 3 + 1 = 4, less than 1→3→4 at 1 + 5 = 6. Node 5 has outgoing edges only, so it is unreachable.

## Hints

- Distances can reach 10^6 × 10^4 = 10^10, beyond 32 bits: use 64-bit integers.
- Zero-weight edges are fine, but with negative weights Dijkstra is no longer correct; that calls for Bellman-Ford.
- Do not settle a node when it is first pushed: its distance is final only when it is popped (and the pair is not stale).
