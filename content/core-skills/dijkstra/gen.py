import json
import random

rng = random.Random(20261028)


def text(n, s, edges):
    return f"{n} {len(edges)} {s}\n" + "".join(f"{u} {v} {w}\n" for u, v, w in edges)


def graph(n, m, wmax):
    edges = [(rng.randint(1, n), rng.randint(1, n), rng.randint(0, wmax)) for _ in range(m)]
    return text(n, rng.randint(1, n), edges)


def chain(n, w):
    """A long heavy path with shortcuts into its first half: the far end lies past 2^31."""
    edges = [(i, i + 1, w) for i in range(1, n)]
    edges += [(1, rng.randint(2, n // 2), w) for _ in range(200)]
    rng.shuffle(edges)
    return text(n, 1, edges)


sample = text(5, 1, [(1, 2, 4), (1, 3, 1), (3, 2, 2), (2, 4, 1), (3, 4, 5), (5, 1, 3)])
# Once settled, a node is never revisited: a lazy-deletion trap where stale pairs pile up.
dense = text(200, 1, [(u, v, abs(u - v) * 3 + (u * v) % 7) for u in range(1, 201) for v in range(1, 201) if u != v][:8000])

print(json.dumps({
    "samples": [sample],
    "tests": [text(1, 1, []), text(3, 2, [(1, 2, 5)]), text(3, 1, [(1, 1, 0), (1, 2, 0), (2, 3, 0), (1, 3, 1)]),
              text(4, 1, [(1, 2, 7), (1, 2, 3), (2, 3, 2), (1, 3, 9), (3, 4, 1), (4, 2, 0)]), graph(30, 60, 20),
              graph(1000, 3000, 1000), chain(5000, 10**6), dense, graph(10000, 9000, 10**6)],
}))
