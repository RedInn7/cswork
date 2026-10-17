import json
import random
from fractions import Fraction

rng = random.Random(20261024)


def splits(rows, c):
    """Every candidate split's exact weighted Gini: (gini, feature, threshold), by one sweep per feature."""
    n, d = len(rows), len(rows[0]) - 1
    total = [sum(r[d] == k for r in rows) for k in range(c)]
    impurity = lambda counts, m: Fraction(m) - Fraction(sum(k * k for k in counts), m)
    out = []
    for f in range(d):
        order = sorted(rows, key=lambda r: r[f])
        left = [0] * c
        for i in range(n - 1):
            left[order[i][d]] += 1
            if order[i][f] != order[i + 1][f]:
                right = [t - l for t, l in zip(total, left)]
                score = (impurity(left, i + 1) + impurity(right, n - i - 1)) / n
                out.append((score, f, Fraction(order[i][f] + order[i + 1][f], 2)))
    return out


def unique_best(rows, c):
    found = splits(rows, c)
    if not found:
        return False
    best = min(s[0] for s in found)
    return sum(s[0] == best for s in found) == 1


def text(rows, c):
    return f"{len(rows)} {len(rows[0]) - 1} {c}\n" + "".join(" ".join(map(str, r)) + "\n" for r in rows)


def case(n, d, c, top, signal):
    """Integer features in [0, top]; the label follows one feature's band, flipped with chance 1 - signal/100.
    Redrawn until the best split is unique, so no two answers tie."""
    while True:
        key = rng.randrange(d)
        cuts = sorted(rng.sample(range(1, top), c - 1)) if top > c else list(range(1, c))
        rows = []
        for _ in range(n):
            x = [rng.randint(0, top) for _ in range(d)]
            label = sum(x[key] > t for t in cuts)
            if rng.randint(1, 100) > signal:
                label = rng.randrange(c)
            rows.append(x + [label])
        if unique_best(rows, c):
            return text(rows, c)


def fixed(rows, c):
    assert unique_best(rows, c)
    return text(rows, c)


sample = fixed([[1, 2, 0], [2, 2, 0], [3, 2, 1], [4, 7, 0], [5, 7, 1], [6, 7, 1], [7, 7, 1]], 2)
# Feature 0 is constant: only feature 1 can split.
constant = fixed([[4, 1, 0], [4, 2, 0], [4, 3, 1], [4, 9, 2]], 3)
pure = fixed([[0, 0], [10, 1]], 2)

print(json.dumps({
    "samples": [sample],
    "tests": [constant, pure, case(20, 2, 2, 5, 80), case(200, 3, 3, 20, 70), case(1000, 6, 4, 30, 60),
              case(1500, 4, 2, 10 ** 6, 75), case(2000, 5, 3, 3, 50)],
}))
