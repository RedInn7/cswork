import json
import random

rng = random.Random(20261016)


def text(ops):
    return f"{len(ops)}\n" + "\n".join(ops) + "\n"


def mixed(q, slow_budget, prints, limit):
    """Random valid operations with at most slow_budget O(n) ones, prints of them included, plus a final print."""
    slow_budget, prints = slow_budget - 1, prints - 1
    ops, values = [], []
    while len(ops) < q:
        r = rng.random()
        if slow_budget and r < 0.04:
            slow_budget -= 1
            kind = rng.choice(["insert", "remove", "remove", "reverse", "print"] if prints else ["insert", "remove", "reverse"])
            if kind == "insert":
                i, x = rng.randint(0, len(values)), rng.randint(-limit, limit)
                values.insert(i, x)
                ops.append(f"insert {i} {x}")
            elif kind == "remove":
                x = rng.choice(values) if values and rng.random() < 0.7 else rng.randint(-limit, limit)
                if x in values:
                    values.remove(x)
                ops.append(f"remove {x}")
            elif kind == "reverse":
                values.reverse()
                ops.append("reverse")
            else:
                prints -= 1
                ops.append("print")
        elif r < 0.1:
            ops.append("size")
        elif values and r < 0.4:
            values.pop(0)
            ops.append("pop_front")
        else:
            x = rng.randint(-limit, limit)
            if rng.random() < 0.5:
                values.insert(0, x)
                ops.append(f"push_front {x}")
            else:
                values.append(x)
                ops.append(f"push_back {x}")
    return ops + ["print"]


sample = text(["push_back 2", "push_back 3", "push_front 1", "insert 1 9", "print", "remove 2", "remove 7",
               "reverse", "print", "pop_front", "size", "print"])
# The tail must follow removals and reversals: push_back after each one.
tail = text(["push_back 1", "remove 1", "print", "push_back 2", "push_back 3", "remove 3", "push_back 4", "print",
             "reverse", "push_back 5", "print", "pop_front", "pop_front", "pop_front", "size", "print",
             "insert 0 6", "push_back 7", "insert 2 8", "print", "reverse", "reverse", "push_front 9", "print"])
# Single nodes, duplicates and inserts at both ends.
edges = text(["reverse", "print", "insert 0 5", "reverse", "print", "push_back 5", "push_back 5", "remove 5",
              "print", "insert 1 6", "insert 0 4", "print", "remove 6", "remove 6", "remove 4", "print", "size",
              "pop_front", "remove 5", "size", "print"])

print(json.dumps({
    "samples": [sample],
    "tests": [tail, edges, text(mixed(200, 60, 15, 50)), text(mixed(2000, 200, 20, 10**9)),
              text(mixed(12000, 200, 5, 999))],
}))
