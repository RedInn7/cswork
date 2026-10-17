import json
import random

import numpy as np

rng = random.Random(20261022)


def text(lam, X, y):
    return f"{len(X)} {len(X[0])} {lam}\n" + "".join(" ".join(row + [t]) + "\n" for row, t in zip(X, y))


def case(n, d, lam, scales=None, noise=20000):
    """Features in thousandths (some columns scaled up), y from integer weights in hundredths plus noise,
    all integer arithmetic so the text is the same on every platform. Redrawn while badly conditioned."""
    scales = scales or [1] * d
    while True:
        # Hundredths, never -1.00: -1 is the float-array checker's exact-match sentinel.
        w = [rng.choice([-1, 1]) * rng.choice([v for v in range(5, 501) if v != 100]) for _ in range(d)]
        b = rng.randint(-100000, 100000)  # 1e-5 units
        X = [[rng.randint(-5000, 5000) * scales[j] for j in range(d)] for _ in range(n)]  # thousandths
        y = [sum(w[j] * x[j] for j in range(d)) + b + rng.randint(-noise, noise) for x in X]  # 1e-5 units
        A = np.array(X, dtype=float) / 1000
        Ac = A - A.mean(axis=0)
        if np.linalg.cond(Ac.T @ Ac + float(lam) * np.eye(d)) < 1e8:
            return text(lam, [[f"{v / 1000:.3f}" for v in x] for x in X], [f"{t / 100000:.5f}" for t in y])


sample = "3 1 2\n1 3\n2 5\n3 7\n"
exact = "4 1 0\n0 1.5\n1 4\n2 6.5\n3 9\n"  # y = 2.5x + 1.5, no noise, no penalty

print(json.dumps({
    "samples": [sample],
    "tests": [exact, case(5, 2, 0), case(8, 3, "0.5"), case(100, 4, 0), case(300, 5, 10, scales=[1, 1, 100, 1, 1]),
              case(600, 8, "250.75"), case(800, 6, "0.001", noise=0), case(50, 8, 100000)],
}))
