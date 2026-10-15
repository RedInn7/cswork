import json
import random

rng = random.Random(20261017)


def text(ops):
    return f"{len(ops)}\n" + "\n".join(ops) + "\n"


def mixed(q, grow, limit):
    ops, size = [], 0
    while len(ops) < q:
        r = rng.random()
        if r < 0.08:
            ops.append("size")
        elif r < 0.2:
            ops.append(rng.choice(["front", "back"]))
        elif size and r < 0.35:
            ops.append(f"get {rng.randrange(size)}")
        elif r < 0.35 + 0.65 * grow:
            ops.append(f"{rng.choice(['push_front', 'push_back'])} {rng.randint(-limit, limit)}")
            size += 1
        else:
            ops.append(rng.choice(["pop_front", "pop_back"]))
            size = max(0, size - 1)
    return ops


sample = text(["push_back 1", "push_back 2", "push_front 3", "get 0", "get 2", "push_front 4", "push_back 5",
               "size", "get 1", "get 4", "pop_back", "pop_front", "front", "back", "pop_front", "pop_front",
               "pop_back", "size", "pop_back"])
# Only push_front: head keeps wrapping, growth must unwrap it.
fronts = text([op for k in range(40) for op in (f"push_front {k}", f"get {k // 2}", "back")])
# A queue that slides: push at one end, pop at the other, so head circles the array many times.
slide = text(["push_back 0", "push_back 1", "push_back 2"]
             + [op for k in range(3, 300) for op in (f"push_back {k}", "pop_front", "get 1", "front")])
slide_back = text(["push_front 0", "push_front 1"]
                  + [op for k in range(2, 300) for op in (f"push_front {k}", "pop_back", "get 0", "back")])
empty = text(["pop_front", "pop_back", "front", "back", "size", "push_back 7", "pop_front", "front",
              "push_front 8", "pop_back", "back", "size"])

print(json.dumps({
    "samples": [sample],
    "tests": [fronts, slide, slide_back, empty, text(mixed(500, 0.6, 100)), text(mixed(5000, 0.5, 10**9)),
              text(mixed(14000, 0.7, 999))],
}))
