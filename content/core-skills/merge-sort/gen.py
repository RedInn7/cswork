import json
import random

rng = random.Random(20261023)


def text(a):
    return f"{len(a)}\n{' '.join(map(str, a))}\n"


def values(n, spread):
    return [rng.randint(-spread, spread) for _ in range(n)]


print(json.dumps({
    "samples": [text([3, 1, 2, 3, 0])],
    "tests": [text([42]), text([2, 1]), text([1, 1, 1, 1]), text(list(range(10))), text(list(range(10, 0, -1))),
              text(values(200, 5)), text(list(range(20000, 0, -1))), text(values(20000, 999)),
              text(values(3000, 10**9))],
}))
