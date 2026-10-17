import json
import random

rng = random.Random(20261019)


def dataset(rows):
    """rows: (label, probabilities as strings)."""
    k = len(rows[0][1])
    return f"{len(rows)} {k}\n" + "".join(f"{label} {' '.join(p)}\n" for label, p in rows)


def text(sets):
    return f"{len(sets)}\n" + "".join(sets)


def row(k, confident):
    """Integer weights over k classes, written to 4 decimals; the true class gets extra weight when confident."""
    label = rng.randrange(k)
    weights = [rng.randint(0, 100) for _ in range(k)]
    if confident:
        weights[label] += rng.randint(0, 400)
    if not sum(weights):
        weights[label] = 1
    total = sum(weights)
    # Largest remainder in units of 1e-4 so the row adds up to exactly 1.0000.
    units = [w * 10000 // total for w in weights]
    for i in sorted(range(k), key=lambda i: -(weights[i] * 10000 % total))[:10000 - sum(units)]:
        units[i] += 1
    return label, [f"{u / 10000:.4f}" for u in units]


def random_set(n, k):
    return dataset([row(k, rng.randint(0, 1)) for _ in range(n)])


sample = text([
    dataset([(0, ["0.9", "0.1"]), (1, ["0.2", "0.8"]), (1, ["0.6", "0.4"])]),
    dataset([(2, ["0.25", "0.25", "0.5"]), (0, ["0", "1", "0"])]),
])
edges = text([
    dataset([(1, ["0", "1"])]),
    dataset([(0, ["0", "1"])]),
    dataset([(0, ["1", "0", "0"]), (1, ["0", "0", "1"]), (2, ["0", "0", "1"])]),
    dataset([(0, ["1e-20", "1"]), (1, ["0.5", "0.5"])]),
    dataset([(3, ["0.25", "0.25", "0.25", "0.25"])] * 4),
])
small = text([random_set(rng.randint(1, 20), rng.randint(2, 6)) for _ in range(40)])

print(json.dumps({
    "samples": [sample],
    "tests": [edges, small, text([random_set(300, 10)]), text([random_set(2000, 3), random_set(400, 20)])],
}))
