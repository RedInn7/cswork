import json
import random

rng = random.Random(20261103)


def text(cash, ops):
    return " ".join(map(str, cash)) + f"\n{len(ops)}\n" + "\n".join(ops) + "\n"


def stock(slots):
    return ["service"] + [f"restock {code} {price} {count}" for code, price, count in slots] + ["resume"]


def customers(n, codes, coins=(10, 50, 100, 500, 500, 100, 5, 1)):
    """n customers: some coins (a few unknown ones), then usually a selection, sometimes a cancel or a refill."""
    ops = []
    for _ in range(n):
        for _ in range(rng.randint(0, 6)):
            ops.append(f"insert {rng.choice(coins)}")
        r = rng.random()
        if r < 0.7:
            ops.append(f"select {rng.choice(codes)}")
            if rng.random() < 0.5:
                ops.append("cancel")
        elif r < 0.85:
            ops.append("cancel")
        elif r < 0.95:
            ops += ["cancel", "service", f"restock {rng.choice(codes)} {rng.randint(1, 60) * 10} {rng.randint(0, 5)}",
                    "cash", "resume"]
        else:
            ops += [rng.choice(["service", "resume", "select A1", "cash"])]
    return ops


sample = text([5, 2, 1, 0], stock([("A1", 120, 2), ("B2", 50, 1)]) + [
    "insert 100", "select A1", "insert 5", "insert 50", "select A1", "cash", "select A1", "insert 500",
    "select B2", "cancel", "cancel", "insert 100", "select B2", "insert 100", "select B2", "cancel", "service", "cash",
])
# Change uses the coins just inserted; with an empty box an exact amount still works; a failed sale keeps
# the escrow for a cancel; restocking needs service mode and keeps adding to the same slot.
edge = text([0, 0, 0, 0], [
    "select A1", "cancel", "restock A1 150 1", "service", "service", "insert 100", "select Z9", "restock A1 150 1",
    "restock A1 150 0", "restock C3 10 3", "resume", "resume", "insert 100", "insert 50", "select A1", "cash",
    "insert 500", "select C3", "insert 10", "select C3", "insert 100", "insert 10", "insert 10", "select C3",
    "cash", "select C3", "cancel", "insert 50", "insert 10", "insert 10", "select C3", "cancel",
    "service", "restock A1 90 2", "resume", "insert 100", "select A1", "cash",
])
# Prices that only work out with the right mix: 500 paid for 140 needs 360 = 100 100 100 50 10.
greedy = text([3, 1, 3, 0], stock([("D4", 140, 9), ("E5", 490, 3), ("F6", 30, 9)]) + [
    "insert 500", "select D4", "cash", "insert 500", "select D4", "insert 500", "select F6", "insert 50",
    "select F6", "cash", "insert 500", "insert 10", "insert 10", "select E5", "cancel", "cash",
])

print(json.dumps({
    "samples": [sample],
    "tests": [
        edge, greedy,
        text([5, 5, 5, 1], stock([("A1", 120, 3), ("A2", 60, 3), ("B1", 250, 2)]) + customers(120, ["A1", "A2", "B1", "B2"])),
        text([0, 0, 0, 0], stock([("A1", 10, 50), ("A2", 40, 50)]) + customers(400, ["A1", "A2"], (10, 50, 100, 500, 7))),
        text([40, 20, 20, 5], stock([(f"{r}{c}", rng.randint(1, 50) * 10, rng.randint(1, 8)) for r in "ABCD" for c in "1234"])
             + customers(1500, [f"{r}{c}" for r in "ABCDE" for c in "1234"])),
        text([10000, 10000, 10000, 10000], stock([("A1", 4990, 100), ("A2", 10, 100)])
             + customers(1500, ["A1", "A2"], (500,))),
    ],
}))
