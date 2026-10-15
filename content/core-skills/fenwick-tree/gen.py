import json
import random

rng = random.Random(20261104)


def text(a, ops):
    return f"{len(a)} {len(ops)}\n{' '.join(map(str, a))}\n" + "\n".join(ops) + "\n"


def case(n, q, limit, zeros=0.0):
    initial = [0 if rng.random() < zeros else rng.randint(0, limit) for _ in range(n)]
    a, total, ops = initial[:], sum(initial), []
    for _ in range(q):
        r = rng.random()
        if r < 0.35:
            i = rng.randint(1, n)
            x = rng.randint(-min(a[i - 1], limit), limit)
            a[i - 1] += x
            total += x
            ops.append(f"add {i} {x}")
        elif r < 0.65:
            ops.append(f"prefix {rng.randint(0, n)}")
        else:
            ops.append(f"kth {rng.randint(1, total + total // 20 + 1)}")
    return text(initial, ops)


sample = text([3, 0, 2, 5], ["prefix 3", "kth 4", "add 2 1", "kth 4", "prefix 0", "kth 11", "kth 12", "kth 1"])
# Long runs of zeros: kth must land on the first index that reaches k, not on a zero before it.
zeros = text([0, 0, 4, 0, 0, 0, 1, 0], ["kth 1", "kth 4", "kth 5", "kth 6", "prefix 8", "add 3 -4", "kth 1",
                                        "kth 2", "add 8 2", "kth 2", "prefix 7", "prefix 2"])

print(json.dumps({
    "samples": [sample],
    "tests": [text([0], ["prefix 1", "kth 1", "add 1 7", "kth 7", "kth 8", "prefix 0"]), zeros,
              text([1] * 16, ["kth 16", "kth 8", "kth 9", "kth 17", "prefix 16", "add 16 -1", "kth 16"]),
              case(30, 100, 9, 0.5), case(1000, 3000, 10**4, 0.3), case(20000, 4000, 10**4, 0.9),
              case(8000, 8000, 50)],
}))
