import json
import random

rng = random.Random(20261030)


def text(x, alpha):
    return f"{len(x)} {alpha}\n{' '.join(x)}\n"


def walk(n, alpha, step, jumps=False):
    """A random walk in hundredths, with occasional level shifts; never exactly -1.00."""
    value, x = rng.randint(-5000, 5000), []
    for _ in range(n):
        value += rng.randint(-step, step) + (rng.choice([-1, 1]) * 3000 if jumps and rng.randint(1, 50) == 1 else 0)
        if value == -100:
            value = -99
        x.append(f"{value / 100:.2f}")
    return text(x, alpha)


sample = text(["10", "20", "20", "5"], "0.5")

print(json.dumps({
    "samples": [sample],
    "tests": [text(["3.5"], "0.3"), text(["2", "4", "8"], "1"), text(["7", "7", "7", "7", "7"], "0.01"), walk(50, "0.2", 100),
              walk(600, "0.05", 300, jumps=True), walk(2500, "0.001", 50), walk(800, "0.9", 1000, jumps=True)],
}))
