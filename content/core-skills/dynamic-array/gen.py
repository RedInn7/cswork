import json
import random

rng = random.Random(20261015)


def text(ops):
    return f"{len(ops)}\n" + "\n".join(ops) + "\n"


def value(limit=10**9):
    return rng.randint(-limit, limit)


def mixed(q, grow, shift_budget, limit=10**9):
    """Random valid operations; grow is the chance a structural step adds rather than removes."""
    ops, size = [], 0
    while len(ops) < q:
        r = rng.random()
        if r < 0.15:
            ops.append(rng.choice(["size", "capacity"]))
        elif size and r < 0.35:
            i = rng.randrange(size)
            ops.append(f"get {i}" if rng.random() < 0.6 else f"set {i} {value(limit)}")
        elif shift_budget and size <= 1000 and r < 0.45:
            shift_budget -= 1
            if size and rng.random() >= grow:
                ops.append(f"erase {rng.randrange(size)}")
                size -= 1
            else:
                ops.append(f"insert {rng.randint(0, size)} {value(limit)}")
                size += 1
        elif size and rng.random() >= grow:
            ops.append("pop")
            size -= 1
        else:
            ops.append(f"push {value(limit)}")
            size += 1
    return ops


sample = text(["push 5", "push 7", "capacity", "push 9", "capacity", "insert 1 3", "get 1",
               "erase 0", "pop", "size", "pop", "capacity", "pop", "capacity"])
# Growth to 32 and back to empty, reading the capacity after every step.
grow_shrink = text([op for k in range(32) for op in (f"push {k}", "capacity")]
                   + [op for _ in range(32) for op in ("pop", "capacity", "size")])
# Inserting at the front and the end, erasing at both ends.
edges = text(["insert 0 1", "insert 0 2", "insert 2 3", "insert 1 4", "get 0", "get 1", "get 2", "get 3",
              "erase 3", "erase 0", "capacity", "erase 1", "erase 0", "size", "capacity", "push 8", "get 0"])
# Bouncing around a power of two must not thrash.
bounce = text(["push 1"] * 8 + [op for _ in range(20) for op in ("push 2", "capacity", "pop", "capacity")])

print(json.dumps({
    "samples": [sample],
    "tests": [grow_shrink, edges, bounce, text(mixed(300, 0.6, 150)), text(mixed(3000, 0.55, 1000)),
              text(mixed(20000, 0.7, 1000, 999)), text(mixed(2000, 0.5, 1000))],
}))
