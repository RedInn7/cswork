import json
import random

import numpy as np

rng = random.Random(20261021)
MARGIN = 1e-6


def text(points, centers, max_iter):
    d = len(points[0])
    rows = [f"{len(points)} {d} {len(centers)} {max_iter}"] + [" ".join(p) for p in points + centers]
    return "\n".join(rows) + "\n"


def safe(points, centers, max_iter):
    """True when no point is ever within MARGIN of a tie between two different centers, so any correct
    implementation (any distance formula, any summation order) assigns exactly the same clusters."""
    X = np.array([[float(v) for v in p] for p in points])
    C = np.array([[float(v) for v in c] for c in centers])

    def assign(C):
        d2 = ((X[:, None, :] - C[None, :, :]) ** 2).sum(axis=2)
        order = np.sort(d2, axis=1)
        distinct = ~np.all(C[None, :, :] == C[:, None, :], axis=2)  # identical centers tie exactly
        best = d2.argmin(axis=1)
        for i in range(len(X)):
            rivals = [d2[i, j] for j in range(len(C)) if distinct[best[i], j]]
            if rivals and min(rivals) - order[i, 0] < MARGIN:
                return None
        return best

    labels = assign(C)
    if labels is None:
        return False
    for _ in range(max_iter):
        for j in range(len(C)):
            if (labels == j).any():
                C[j] = X[labels == j].mean(axis=0)
        moved = assign(C)
        if moved is None:
            return False
        if np.array_equal(moved, labels):
            break
        labels = moved
    return True


def blobs(n, d, k, max_iter, spread, noise, start="points"):
    """Points around k hidden integer centers, 2 decimals; initial centers drawn from the points
    (or anywhere in the box), redrawn until the run is free of near-ties."""
    while True:
        hidden = [[rng.randint(-spread, spread) * 100 for _ in range(d)] for _ in range(k)]
        points = []
        for _ in range(n):
            c = rng.choice(hidden)
            points.append([f"{(v + sum(rng.randint(-noise, noise) for _ in range(3))) / 100:.2f}" for v in c])
        if start == "points":
            centers = [list(p) for p in rng.sample(points, k)]
        else:
            centers = [[f"{rng.randint(-spread * 100, spread * 100) / 100:.2f}" for _ in range(d)] for _ in range(k)]
        if safe(points, centers, max_iter):
            return text(points, centers, max_iter)


def fixed(points, centers, max_iter):
    as_text = lambda rows: [[str(v) for v in row] for row in rows]
    assert safe(as_text(points), as_text(centers), max_iter)
    return text(as_text(points), as_text(centers), max_iter)


sample = fixed([[1, 1], [1, 2], [2, 1], [8, 8], [8, 9], [9, 8]], [[1, 1], [2, 1], [20, 20]], 10)
# Two identical starting centers: every tie goes to the lower index, so the second stays empty.
twins = fixed([[0, 0], [1, 0], [0, 1], [10, 10], [11, 10]], [[5, 5], [5, 5], [10, 11]], 10)
# One update only: point 2 has just changed clusters when max_iter runs out.
one_step = fixed([[0], [1], [2], [10], [11], [30]], [[0], [3]], 1)
single = fixed([[3, -1], [-2, 4], [7, 0.5]], [[100, 100]], 5)

print(json.dumps({
    "samples": [sample],
    "tests": [twins, one_step, single, blobs(30, 2, 3, 20, 10, 150), blobs(200, 3, 4, 30, 20, 400),
              blobs(500, 4, 6, 50, 30, 700, start="box"), blobs(500, 2, 8, 3, 50, 900)],
}))
