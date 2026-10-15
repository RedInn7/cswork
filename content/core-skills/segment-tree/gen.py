import json
import random

rng = random.Random(20261103)


def text(a, ops):
    return f"{len(a)} {len(ops)}\n{' '.join(map(str, a))}\n" + "\n".join(ops) + "\n"


def case(n, q, limit, updates=0.4):
    a = [rng.randint(-limit, limit) for _ in range(n)]
    ops = []
    for _ in range(q):
        if rng.random() < updates:
            ops.append(f"set {rng.randint(1, n)} {rng.randint(-limit, limit)}")
        else:
            l, r = sorted((rng.randint(1, n), rng.randint(1, n)))
            ops.append(f"sum {l} {r}")
    return text(a, ops)


big = 10**9
print(json.dumps({
    "samples": [text([5, -2, 7, 1, 3], ["sum 1 3", "set 2 4", "sum 1 3", "sum 2 5", "sum 4 4"])],
    "tests": [text([7], ["sum 1 1", "set 1 -3", "sum 1 1"]), text([1, 2], ["sum 1 2", "sum 2 2", "set 1 5", "sum 1 2"]),
              text([big] * 3000, ["sum 1 3000", "set 3000 -1000000000", "sum 1 3000", "sum 3000 3000"]),
              case(7, 30, 9), case(100, 300, 1000), case(1000, 3000, big), case(20000, 4000, 99, 0.5),
              case(5000, 5000, big, 0.2)],
}))
