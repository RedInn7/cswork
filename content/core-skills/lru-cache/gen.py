import json
import random

rng = random.Random(20261020)


def text(capacity, ops):
    return f"{capacity} {len(ops)}\n" + "\n".join(ops) + "\n"


def mixed(capacity, q, keys, order_every=0, values=10**9):
    ops = []
    while len(ops) < q:
        if order_every and len(ops) % order_every == 0:
            ops.append("order")
        k = rng.randrange(keys)
        if rng.random() < 0.5:
            ops.append(f"get {k}")
        else:
            ops.append(f"put {k} {rng.randint(0, values)}")
    return ops + ["order"]


sample = text(2, ["put 1 1", "put 2 2", "order", "get 1", "order", "put 3 3", "get 2", "put 1 10", "get 1",
                  "order", "put 4 4", "get 3", "order"])
# Capacity 1: every new key evicts the previous one; updates evict nothing.
single = text(1, ["get 5", "order", "put 5 1", "put 5 2", "get 5", "put 6 3", "get 5", "get 6", "order",
                  "put 6 4", "put 7 5", "order"])
# Gets refresh recency: a key touched just in time survives a sweep of new keys.
refresh = text(3, ["put 1 1", "put 2 2", "put 3 3"]
               + [op for k in range(4, 40) for op in ("get 1", f"put {k} {k}", "order")])

print(json.dumps({
    "samples": [sample],
    "tests": [single, refresh, text(5, mixed(5, 400, 12, 20)), text(50, mixed(50, 3000, 120, 300)),
              text(1000, mixed(1000, 12000, 2500, 4000, 999)), text(10000, mixed(10000, 12000, 12000, 0, 99))],
}))
