import json
import random

import numpy as np

rng = random.Random(20261031)


def text(X, m):
    return f"{len(X)} {len(X[0])} {m}\n" + "".join(" ".join(row) + "\n" for row in X)


def well_posed(X, m):
    """Distinct leading eigenvalues (so the components are defined), a clear largest entry in each
    (so the sign rule is), and no -1.000000 anywhere in the answer (the float-array sentinel)."""
    A = np.array([[float(v) for v in row] for row in X])
    Ac = A - A.mean(axis=0)
    values, vectors = np.linalg.eigh(Ac.T @ Ac / (len(A) - 1))
    values, vectors = values[::-1], vectors[:, ::-1]
    top = values[:m + 1] if m < len(values) else values[:m]
    if values[0] <= 0 or np.any(-np.diff(top) <= 1e-3 * values[0]):
        return False
    for k in range(m):
        size = np.sort(np.abs(vectors[:, k]))
        if len(size) > 1 and size[-1] - size[-2] < 1e-6:
            return False
    components = vectors[:, :m].T
    components *= np.sign(components[np.arange(m), np.abs(components).argmax(axis=1)])[:, None]
    answer = np.concatenate([components.ravel(), values[:m] / values.sum(), (Ac @ components.T).ravel()])
    return not np.any(np.abs(answer + 1) < 1e-6)


def case(n, d, m, spread):
    """Points from a random integer mixing of independent integer factors with shrinking scales."""
    while True:
        mix = [[rng.randint(-5, 5) for _ in range(d)] for _ in range(d)]
        scales = sorted((rng.randint(1, spread) for _ in range(d)), reverse=True)
        X = []
        for _ in range(n):
            z = [rng.randint(-s, s) for s in scales]
            X.append([f"{sum(mix[i][j] * z[j] for j in range(d)) / 100:.2f}" for i in range(d)])
        if well_posed(X, m):
            return text(X, m)


def fixed(X, m):
    X = [[str(v) for v in row] for row in X]
    assert well_posed(X, m)
    return text(X, m)


sample = fixed([[0, 0], [2, 1], [4, 3], [6, 2]], 2)
# Variance along one axis only: the component is that axis, and every other direction explains nothing.
line = fixed([[0, 5], [1, 5], [3, 5], [7, 5]], 1)
three = fixed([[2, 0, 1], [0, 1, 0], [1, 3, 2], [4, 1, 1], [3, 2, 5]], 3)

print(json.dumps({
    "samples": [sample],
    "tests": [line, three, case(20, 3, 2, 300), case(100, 4, 2, 500), case(300, 6, 3, 800), case(200, 5, 5, 400)],
}))
