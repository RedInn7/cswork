import json
import random

rng = random.Random(20261018)


def text(seed, ns):
    return f"{seed} {len(ns)}\n" + "\n".join(map(str, ns)) + "\n"


sample = text(4, [2, 5, 1])
# n = 1: the even thread has nothing to emit and must still return.
small = text(8, [1, 2, 1, 3, 2, 1] * 10)
tests = [small] + [text(rng.randrange(10**9), [rng.randint(1, hi) for _ in range(count)])
                   for count, hi in ((40, 10), (40, 30), (25, 50))]
print(json.dumps({"samples": [sample], "tests": tests}))
