import json
import random

rng = random.Random(20261101)


def text(n, ops):
    return f"{n} {len(ops)}\n" + "\n".join(ops) + "\n"


def mixed(n, q, merge):
    ops = []
    for _ in range(q):
        r = rng.random()
        a, b = rng.randint(1, n), rng.randint(1, n)
        if r < merge:
            ops.append(f"union {a} {b}")
        elif r < merge + (1 - merge) * 0.5:
            ops.append(f"same {a} {b}")
        elif r < 0.97:
            ops.append(f"size {a}")
        else:
            ops.append("count")
    return ops


sample = text(5, ["count", "union 1 2", "union 3 4", "count", "union 2 1", "union 1 3", "size 4", "same 2 4",
                  "same 1 5", "size 5", "count"])
# A long chain built by unions of consecutive nodes, then queries from both ends.
chain = text(100000, [f"union {i} {i + 1}" for i in range(1, 6000)]
             + ["size 1", "size 6000", "same 1 6000", "same 1 6001", "count"])

print(json.dumps({
    "samples": [sample],
    "tests": [text(1, ["count", "union 1 1", "size 1", "same 1 1", "count"]),
              text(3, ["union 1 2", "union 2 3", "union 3 1", "size 2", "count"]), text(20, mixed(20, 100, 0.4)),
              text(1000, mixed(1000, 3000, 0.3)), chain, text(100000, mixed(100000, 8000, 0.7)),
              text(500, mixed(500, 12000, 0.05))],
}))
