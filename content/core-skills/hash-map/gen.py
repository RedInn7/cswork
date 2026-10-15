import json
import random

rng = random.Random(20261018)


def text(ops):
    return f"{len(ops)}\n" + "\n".join(ops) + "\n"


def mixed(q, keys, values=10**9):
    """Random operations over a key pool, so gets and removes often hit."""
    ops = []
    while len(ops) < q:
        r, k = rng.random(), rng.choice(keys)
        if r < 0.45:
            ops.append(f"put {k} {rng.randint(0, values)}")
        elif r < 0.75:
            ops.append(f"get {k}")
        elif r < 0.9:
            ops.append(f"remove {k}")
        else:
            ops.append(rng.choice(["size", "buckets"]))
    return ops


sample = text(["put 10 1", "put 20 2", "put 30 3", "put 40 4", "put 50 5", "put 60 6", "buckets", "put 70 7",
               "buckets", "put 10 100", "get 10", "size", "remove 20", "remove 20", "get 20", "get 70", "size"])
# Growth points: 6 → 7 keys doubles 8 → 16, 12 → 13 doubles to 32, and so on; updates never grow.
growth = text([op for k in range(100) for op in (f"put {k} {k}", "buckets", f"put {k} {k + 1}", "size")]
              + [op for k in range(0, 100, 3) for op in (f"remove {k}", "buckets")]
              + [f"get {k}" for k in range(100)])
# Multiples of 1024 and negative keys, all in play at once.
clustered = text(mixed(3000, [1024 * k for k in range(-400, 400)], 9))
negative = text(mixed(2000, [-k for k in range(1, 300)] + [k for k in range(1, 300)] + [-10**9, 10**9, 0]))
edges = text(["get 0", "remove 0", "put 0 0", "get 0", "put -1 5", "get -1", "remove 0", "get 0", "size",
              "put 1000000000 9", "put -1000000000 8", "get 1000000000", "get -1000000000", "buckets"])

print(json.dumps({
    "samples": [sample],
    "tests": [growth, clustered, negative, edges, text(mixed(500, list(range(50)))),
              text(mixed(5000, [rng.randint(-10**9, 10**9) for _ in range(2000)])),
              text(mixed(14000, list(range(-3000, 9000)), 999))],
}))
