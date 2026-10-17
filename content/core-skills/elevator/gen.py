import json
import random

rng = random.Random(20261102)


def text(floors, start, ops):
    return f"{floors} {start}\n{len(ops)}\n" + "\n".join(ops) + "\n"


def mixed(floors, q, busy):
    """Requests arrive between runs of steps; `busy` is the share of requests among the operations."""
    ops = []
    while len(ops) < q:
        r = rng.random()
        if r < busy / 2:
            ops.append(f"call {rng.randint(1, floors)} {rng.choice('UD')}")
        elif r < busy:
            ops.append(f"press {rng.randint(1, floors)}")
        elif r < busy + 0.05:
            ops.append("where")
        else:
            ops += ["step"] * rng.randint(1, 4)
    return ops[:q]


sample = text(10, 5, ["press 7", "call 3 D", "call 9 D", "step", "step", "call 8 D", "step", "step", "where",
                      "step", "press 1", "call 4 U", "step", "step", "step", "step", "step", "step", "step", "where"])
# Up and down calls on the same floor: going up the car stops for the up call only and comes back for the
# down call; at the far end of a sweep it takes both at once.
same_floor = text(9, 1, ["call 5 U", "call 5 D", "call 7 U", "step", "step", "step", "step", "where", "step", "step",
                         "step", "step", "where", "call 3 U", "call 3 D", "step", "step", "step", "step", "step",
                         "step", "where"])
# Idle choices: work above wins over work below; a call at the idle car's own floor opens on the next step;
# a button for the floor the car is on opens at once.
idle = text(20, 10, ["step", "where", "press 10", "call 10 U", "where", "step", "where", "call 4 D", "call 15 U",
                     "step", "step", "step", "step", "step", "press 12", "step", "step", "step", "step", "step", "step",
                     "step", "step", "step", "step", "step", "step", "step", "step", "step", "where"])
# A one-floor building and the top and bottom floors.
tiny = text(1, 1, ["step", "call 1 U", "press 1", "where", "step", "step", "call 1 D", "call 1 U", "step", "where"])
ends = text(6, 6, ["press 1", "call 6 D", "step", "step", "step", "step", "step", "call 6 D", "call 1 U", "step",
                   "step", "step", "step", "step", "step", "step", "step", "step", "step", "step", "where"])

print(json.dumps({
    "samples": [sample],
    "tests": [same_floor, idle, tiny, ends, text(8, 1, mixed(8, 300, 0.3)), text(30, 15, mixed(30, 3000, 0.2)),
              text(200, 100, mixed(200, 8000, 0.15)), text(200, 1, mixed(200, 8000, 0.6))],
}))
