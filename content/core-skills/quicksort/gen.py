import json
import random

rng = random.Random(20261022)


def text(a):
    return f"{len(a)}\n{' '.join(map(str, a))}\n"


def distinct(n, spread):
    return rng.sample(range(-spread, spread + 1), n)


sample = text([3, 8, 1, 9, 2, 5])
ascending = sorted(distinct(8000, 9999))
organ = list(range(1, 4001)) + list(range(8000, 4000, -1))

print(json.dumps({
    "samples": [sample],
    "tests": [text([7]), text([2, 1]), text([1, 2]), text([5, 1, 4, 2, 3]), text(distinct(100, 1000)),
              text(ascending), text(ascending[::-1]), text(organ), text(distinct(4000, 10**9)),
              text(distinct(10000, 10**4))],
}))
