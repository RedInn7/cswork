import json
import random

rng = random.Random(20261021)


def text(a, queries):
    return f"{len(a)} {len(queries)}\n{' '.join(map(str, a))}\n" + "\n".join(map(str, queries)) + "\n"


def case(n, q, spread):
    """Sorted values with duplicates; queries hit values, gaps and both ends."""
    a = sorted(rng.randint(-spread, spread) for _ in range(n))
    queries = [rng.choice(a) if rng.random() < 0.5 else rng.randint(-spread - 2, spread + 2) for _ in range(q)]
    return text(a, queries)


sample = text([1, 3, 3, 3, 7, 9], [3, 0, 10, 5, 1, 9])
single = text([5], [4, 5, 6])
same = text([2] * 10, [1, 2, 3])
extremes = text([-10**9, -10**9, 0, 10**9, 10**9], [-10**9, 10**9, 0, -1, 1, -10**9 + 1, 10**9 - 1])

print(json.dumps({
    "samples": [sample],
    "tests": [single, same, extremes, case(50, 100, 20), case(1000, 1000, 10**9), case(10000, 10000, 5000),
              case(8000, 4000, 10**9)],
}))
