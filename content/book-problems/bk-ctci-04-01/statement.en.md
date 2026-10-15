# Is There a Route Between Two Nodes?
Given a directed graph with nodes 0 to n-1, possibly with repeated edges and self-loops, decide whether node t can be reached from node s by following edges in their direction. A node reaches itself.

## Input
The first line holds two integers n and m (1 ≤ n ≤ 10000, 0 ≤ m ≤ 10000).
Each of the next m lines holds two integers u and v: an edge from u to v.
The last line holds two integers s and t.

## Output
Print true if t is reachable from s, otherwise false.

## Sample explanation
Sample 1 has the edges 0→1, 1→2, 1→2 (repeated), 3→3 (a self-loop) and 2→0; from 0 the path 0→1→2 reaches 2, so the answer is true.
Sample 2 has only the edge 1→0, which points the other way, so 1 cannot be reached from 0.

## Hints
- Run BFS or DFS from s with a visited array and stop as soon as t shows up.
- Edges have a direction: add only u→v when building the graph.
