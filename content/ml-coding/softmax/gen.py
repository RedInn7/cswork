import json
import random

rng = random.Random(20261025)


def text(rows):
    return f"{len(rows)} {len(rows[0])}\n" + "".join(" ".join(r) + "\n" for r in rows)


def rows(n, k, low, high, scale):
    """Logits as integers over `scale`, written exactly."""
    digits = len(str(scale)) - 1
    return [[f"{rng.randint(low, high) / scale:.{digits}f}" for _ in range(k)] for _ in range(n)]


sample = text([["1", "2", "3"], ["1000", "1000", "999"], ["-50", "0", "50"]])
# exp(1000) overflows and exp(-1000) underflows: only the shifted forms survive.
extremes = text([["1000", "-1000"], ["-1000", "-1000.5"], ["0", "0"], ["745", "-745"], ["1e5", "1e5"], ["-3.25", "710"]])
single = text([["42"], ["-1e4"]])

print(json.dumps({
    "samples": [sample],
    "tests": [extremes, single, text(rows(20, 5, -500, 500, 100)), text(rows(100, 10, -10 ** 6, 10 ** 6, 1000)),
              text(rows(150, 30, -2000, 2000, 1)), text(rows(15, 200, -10 ** 5, 10 ** 5, 10000))],
}))
