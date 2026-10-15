import json
import random

rng = random.Random(20261019)


def text(ops):
    return f"{len(ops)}\n" + "\n".join(ops) + "\n"


def mixed(q, limit, dump_size, build_size=0, build_budget=0):
    """Random operations; dumps only while the heap is small, builds of at most build_size values."""
    ops, size, dumped = [], 0, 0
    while len(ops) < q:
        r = rng.random()
        if r < 0.08:
            ops.append(rng.choice(["size", "top"]))
        elif size <= dump_size and dumped + size <= 50000 and r < 0.12:
            ops.append("dump")
            dumped += size
        elif build_size <= build_budget and r < 0.125:
            k = rng.randint(0, build_size)
            build_budget -= k
            ops.append(" ".join(["build", str(k)] + [str(rng.randint(-limit, limit)) for _ in range(k)]))
            size = k
        elif size and r < 0.5:
            ops.append("pop")
            size -= 1
        else:
            ops.append(f"push {rng.randint(-limit, limit)}")
            size += 1
    return ops


sample = text(["push 5", "push 3", "push 8", "push 1", "dump", "pop", "dump", "top", "size",
               "build 5 9 4 7 1 2", "dump", "pop", "pop", "dump"])
# Equal values: ties go left and equal elements never swap.
ties = text(["build 7 2 1 1 2 1 1 2", "dump", "push 1", "dump", "pop", "dump", "pop", "dump", "push 0", "push 0",
             "dump", "pop", "dump", "build 4 5 5 5 5", "dump", "pop", "dump"])
# Sorted, reversed and empty builds; draining to empty and pushing again.
shapes = text(["build 8 1 2 3 4 5 6 7 8", "dump", "build 8 8 7 6 5 4 3 2 1", "dump", "pop", "dump",
               "build 0", "dump", "pop", "top", "size", "build 1 4", "pop", "dump", "pop", "push 6", "dump",
               "build 3 3 1 2", "pop", "pop", "pop", "top", "dump"])
heapsort = text(["build 200 " + " ".join(str(rng.randint(-50, 50)) for _ in range(200))] + ["pop"] * 200 + ["dump"])

print(json.dumps({
    "samples": [sample],
    "tests": [ties, shapes, heapsort, text(mixed(300, 20, 40, 30, 300)), text(mixed(3000, 10**9, 60, 200, 1000)),
              text(mixed(14000, 999, 30, 3000, 12000))],
}))
