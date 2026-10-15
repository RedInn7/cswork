# Bellman-Ford and Negative Cycles

A graph has n nodes and m **directed edges** whose weights **may be negative**. Implement `bellman_ford(n, edges, s)`:

- If a **negative cycle** (a cycle whose weights sum below 0) is reachable from the source s, shortest paths are meaningless: return "nothing" (Python `None`, an empty vector in C++, Java `null`, Go `nil`);
- Otherwise return the shortest distance from s to every node, with the starter code's constant `INF` for unreachable ones.

Bellman-Ford: the source starts at 0 and every other node at INF. One round relaxes every edge once. A shortest path uses at most n - 1 edges, so after n - 1 rounds every distance is right. Then scan the edges once more: if any edge still shortens a distance, a negative cycle is reachable from s.

Relax only from nodes whose distance is not INF, or "INF plus a negative weight" passes for a reachable distance. Function names follow each language's conventions (Java `bellmanFord`, Go `BellmanFord`); the starter code has them.

## Input

The first line holds n, m and s. Each of the next m lines holds three integers u v w: a directed edge from u to v of weight w.

1 ≤ n ≤ 500, 0 ≤ m ≤ 2000, 1 ≤ s ≤ n, |w| ≤ 10^4.

## Output

If a negative cycle is reachable from s, print the line NEGATIVE CYCLE. Otherwise print one line of n values: the shortest distances from s to nodes 1, 2, …, n, with INF for unreachable ones.

## Explanation

From 1: 1→2 costs 4, but 1→3→2 costs 5 + (-3) = 2, which is shorter, and 1→3→2→4 costs 2 + 2 = 4. Node 5 is unreachable, so it prints INF.

## Hints

- If a round changes no distance, stop early: nothing will change later either.
- Only a negative cycle reachable from s counts. One elsewhere in the graph does not affect the answer, so the final check also looks only at nodes whose distance is not INF.
- The cost is O(nm), slower than Dijkstra, in exchange for handling negative weights.
