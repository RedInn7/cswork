import json
import random

rng = random.Random(20261029)


def text(n, s, edges):
    return f"{n} {len(edges)} {s}\n" + "".join(f"{u} {v} {w}\n" for u, v, w in edges)


def potential_graph(n, m):
    """Negative weights but no negative cycle: w(u, v) = c(u, v) + p(u) - p(v) with c >= 0."""
    p = [0] + [rng.randint(-3000, 3000) for _ in range(n)]
    edges = []
    for _ in range(m):
        u, v = rng.randint(1, n), rng.randint(1, n)
        w = rng.randint(0, 4000) + p[u] - p[v]
        if abs(w) <= 10**4:
            edges.append((u, v, w))
    return edges


def plant_cycle(n, edges, reachable_from):
    """A 3-node cycle of total weight -1, entered from a node reachable_from can reach."""
    a, b, c = rng.sample(range(2, n + 1), 3)
    return edges + [(reachable_from, a, 5), (a, b, 4), (b, c, -2), (c, a, -3)]


sample = text(5, 1, [(1, 2, 4), (1, 3, 5), (3, 2, -3), (2, 4, 2), (5, 4, -1)])
# A negative cycle nobody reaches from s must not matter.
island = text(5, 1, [(1, 2, 3), (2, 3, -1), (4, 5, -2), (5, 4, 1)])
# The longest shortest path needs all n - 1 rounds when edges come in reverse order.
reversed_chain = text(500, 1, [(i, i + 1, -7) for i in range(499, 0, -1)])

print(json.dumps({
    "samples": [sample],
    "tests": [text(1, 1, []), text(2, 1, [(1, 1, -1)]), text(3, 2, [(1, 2, -5), (2, 3, -5)]), island,
              text(4, 1, [(1, 2, 1), (2, 3, -1), (3, 2, 1), (3, 4, 2)]), reversed_chain,
              text(60, 7, potential_graph(60, 200)), text(500, 1, potential_graph(500, 2000)),
              text(500, 1, plant_cycle(500, potential_graph(500, 1990), 1)),
              text(300, 300, potential_graph(300, 1500))],
}))
