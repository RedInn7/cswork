import json
import random

rng = random.Random(20261027)


def text(n, edges):
    return f"{n} {len(edges)}\n" + "".join(f"{u} {v}\n" for u, v in edges)


def dag(n, m):
    """Edges that follow a hidden random order, so the graph is acyclic."""
    rank = list(range(1, n + 1))
    rng.shuffle(rank)
    edges = []
    for _ in range(m):
        i, j = sorted(rng.sample(range(n), 2))
        edges.append((rank[i], rank[j]))
    return edges


def with_cycle(n, m):
    edges = dag(n, m)
    u, v = edges[rng.randrange(len(edges))]
    path = [v] + rng.sample([x for x in range(1, n + 1) if x not in (u, v)], 3) + [u]
    return edges + list(zip(path, path[1:])) + [(u, v)]


print(json.dumps({
    "samples": [text(4, [(3, 1), (3, 2), (4, 2)])],
    "tests": [text(1, []), text(5, []), text(2, [(1, 2), (2, 1)]), text(3, [(3, 2), (3, 2), (2, 1)]),
              text(6, [(6, 5), (5, 4), (4, 3), (3, 2), (2, 1)]), text(30, dag(30, 40)), text(30, with_cycle(30, 30)),
              text(2000, dag(2000, 5000)), text(10000, dag(10000, 12000)), text(10000, with_cycle(10000, 12000)),
              text(10000, dag(10000, 3000))],
}))
