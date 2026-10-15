import json
import random

rng = random.Random(20261030)


def text(n, edges):
    return f"{n} {len(edges)}\n" + "".join(f"{u} {v} {w}\n" for u, v, w in edges)


def connected(n, m, wmax):
    """A random spanning tree plus random extra edges, shuffled."""
    order = list(range(1, n + 1))
    rng.shuffle(order)
    edges = [(order[i], order[rng.randrange(i)], rng.randint(1, wmax)) for i in range(1, n)]
    edges += [(rng.randint(1, n), rng.randint(1, n), rng.randint(1, wmax)) for _ in range(m - (n - 1))]
    rng.shuffle(edges)
    return edges


sample = text(4, [(3, 4, 3), (2, 3, 2), (1, 3, 1), (2, 4, 4), (1, 2, 2)])
# Many equal weights: the input order decides which edges are chosen.
ties = text(6, [(u, v, 5) for u in range(1, 7) for v in range(u + 1, 7)])

print(json.dumps({
    "samples": [sample],
    "tests": [text(1, []), text(1, [(1, 1, 4)]), text(2, []), text(3, [(1, 2, 1), (1, 2, 1), (2, 2, 1)]),
              text(3, [(1, 1, 1), (1, 2, 9), (2, 1, 3), (2, 3, 3), (3, 1, 3)]), ties, text(50, connected(50, 120, 5)),
              text(40, connected(20, 60, 100)), text(2000, connected(2000, 6000, 10**6)),
              text(8000, connected(8000, 9000, 10**4)), text(5000, connected(5000, 5000, 3))],
}))
