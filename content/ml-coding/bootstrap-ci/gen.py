import json
import random

rng = random.Random(20261029)


def text(x, B, level, seed):
    return f"{len(x)} {B} {level} {seed}\n{' '.join(x)}\n"


def case(n, B, level, skew):
    """Values in hundredths; `skew` stretches the right tail (incomes, latencies)."""
    x = []
    for _ in range(n):
        v = rng.randint(0, 10000)
        if skew and rng.randint(1, 10) == 1:
            v *= rng.randint(2, skew)
        x.append(f"{v / 100:.2f}")
    return text(x, B, level, rng.randrange(2 ** 32))


sample = text(["1", "2", "3", "4"], 5, "0.6", 1)

print(json.dumps({
    "samples": [sample],
    "tests": [text(["5", "5", "5"], 10, "0.9", 0), text(["0", "10"], 2, "0.95", 4294967295), case(10, 100, "0.95", 0),
              case(50, 1000, "0.9", 20), case(200, 1000, "0.99", 50), case(100, 2000, "0.8", 0), case(30, 777, "0.95", 5)],
}))
