import json
import random

rng = random.Random(20261021)


def text(seed, rounds):
    return f"{seed} {len(rounds)}\n" + "\n".join(" ".join(map(str, r)) for r in rounds) + "\n"


def mixed(count, k_max):
    return [[rng.randint(1, 5), rng.randint(1, 3), rng.randint(1, 3), rng.randint(1, k_max)] for _ in range(count)]


sample = text(1, [[2, 1, 1, 5], [1, 2, 2, 3], [3, 3, 1, 4]])
# Capacity 1: every put and take hands over to the other side.
tight = text(5, [[1, rng.randint(1, 3), rng.randint(1, 3), rng.randint(1, 20)] for _ in range(20)])
tests = [tight, text(rng.randrange(10**9), mixed(25, 10)), text(rng.randrange(10**9), mixed(12, 60))]
print(json.dumps({"samples": [sample], "tests": tests}))
