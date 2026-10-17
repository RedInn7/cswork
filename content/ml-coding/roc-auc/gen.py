import json
import random

rng = random.Random(20261018)


def dataset(y, scores):
    return f"{len(y)}\n{' '.join(map(str, y))}\n{' '.join(scores)}\n"


def text(sets):
    return f"{len(sets)}\n" + "".join(sets)


def scored(n, levels, signal):
    """Scores on a grid of `levels` values (so ties are common); positives sit `signal` levels higher on average."""
    y = [rng.randint(0, 1) for _ in range(n)]
    y[0], y[1] = 0, 1  # both classes present
    scores = []
    for label in y:
        level = min(levels, max(0, rng.randint(0, levels - signal) + (signal if label else 0) - rng.randint(0, signal)))
        scores.append(f"{level / levels:.3f}")
    return dataset(y, scores)


sample = text([
    dataset([0, 0, 1, 1], ["0.1", "0.4", "0.35", "0.8"]),
    dataset([1, 0, 1, 0, 1], ["0.9", "0.5", "0.5", "0.2", "0.5"]),
])
edges = text([
    dataset([0, 1], ["0.2", "0.7"]),
    dataset([1, 0], ["0.2", "0.7"]),
    dataset([1, 0, 1, 0], ["0.5", "0.5", "0.5", "0.5"]),
    dataset([0, 0, 0, 1], ["-3", "-2.5", "-2.5", "-2.5"]),
    dataset([1, 1, 1, 0, 0], ["1e-3", "2e-3", "3e-3", "1e-3", "0"]),
])
small = text([scored(rng.randint(2, 30), rng.randint(2, 10), 1) for _ in range(50)])

print(json.dumps({
    "samples": [sample],
    "tests": [edges, small, text([scored(2000, 20, 4)]), text([scored(6000, 1000, 300), scored(6000, 5, 1)]),
              text([scored(5000, 100000, 20000)])],
}))
