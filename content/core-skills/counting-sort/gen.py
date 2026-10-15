import json
import random

rng = random.Random(20261024)


def text(k, keys):
    return f"{len(keys)} {k}\n{' '.join(map(str, keys))}\n"


def case(n, k):
    return text(k, [rng.randrange(k) for _ in range(n)])


print(json.dumps({
    "samples": [text(3, [2, 0, 2, 1, 0])],
    "tests": [text(1, [0]), text(1, [0] * 7), text(5, [4, 3, 2, 1, 0]), text(100000, [99999, 0, 99999, 0]),
              case(50, 3), case(2000, 10), case(20000, 100000), case(20000, 7)],
}))
