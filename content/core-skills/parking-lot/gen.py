import json
import random

rng = random.Random(20261101)


def text(counts, rates, ops):
    return f"{counts[0]} {counts[1]} {counts[2]}\n{rates[0]} {rates[1]} {rates[2]}\n{len(ops)}\n" + "\n".join(ops) + "\n"


def mixed(counts, q, plates, tmax, step=30):
    """Random parks, exits (mostly real tickets, some stale or unknown) and queries at nondecreasing times."""
    ops, t, issued = [], 0, 0
    for _ in range(q):
        t = min(tmax, t + rng.randint(0, step))
        r = rng.random()
        if r < 0.5:
            issued += 1  # an upper bound on tickets issued so far
            ops.append(f"park P{rng.randrange(plates)} {rng.choice('SSMML')} {t}")
        elif r < 0.9:
            ops.append(f"unpark {rng.randint(1, issued + 2)} {t}")
        else:
            ops.append(f"available {rng.choice('SML')}")
    return ops


sample = text([2, 1, 1], [2, 3, 5], [
    "park A1 S 0", "park B2 M 10", "park C3 M 10", "park D4 L 20", "park A1 S 30", "available S",
    "unpark 2 70", "park D4 L 75", "unpark 3 190", "park D4 L 190", "unpark 2 200", "unpark 1 200", "available M",
])
# Fee boundaries: 0, 1, 59, 60, 61 and 120 minutes; a small car falls through to medium, then large.
boundaries = text([1, 1, 1], [7, 11, 13], [
    "park a S 100", "park b S 100", "park c S 100", "park d S 100", "available S", "available M", "available L",
    "unpark 1 100", "unpark 2 101", "unpark 3 159", "park a S 200", "park b M 200", "park c L 200",
    "unpark 4 260", "unpark 5 261", "unpark 6 320", "unpark 6 320", "unpark 0 320", "unpark 99 320",
])
# No small spots at all; a large vehicle never takes a smaller spot; the same plate comes back after leaving.
no_small = text([0, 2, 1], [1, 2, 3], [
    "available S", "park x S 0", "park y L 0", "park z L 0", "park w M 0", "park v M 0", "unpark 2 0",
    "park z L 0", "park x S 5", "unpark 1 30", "park x S 30", "unpark 6 31", "available M", "available L",
])
# 64-bit fees: a car parked for most of 10^9 minutes at the highest rate.
huge = text([1, 1, 1], [10000, 9999, 1], [
    "park long S 0", "park mid M 5", "park slow L 7", "unpark 1 1000000000", "unpark 2 999999999",
    "unpark 3 1000000000",
])
# Many exits of the same ticket at once, and a full lot that opens up one spot at a time.
churn = []
for k in range(1, 41):
    churn += [f"park c{k} {'SML'[k % 3]} {k}"]
churn += [f"unpark {k} 500" for k in range(1, 41, 2)] + [f"unpark {k} 500" for k in range(1, 41, 4)]
churn += [f"park d{k} L 600" for k in range(30)] + ["available S", "available M", "available L"]

print(json.dumps({
    "samples": [sample],
    "tests": [
        boundaries, no_small, huge, text([5, 5, 5], [3, 4, 9], churn),
        text([4, 3, 2], [2, 3, 5], mixed([4, 3, 2], 400, 20, 10**6)),
        text([50, 30, 10], [100, 250, 600], mixed([50, 30, 10], 4000, 150, 10**9, 2000)),
        text([20000, 20000, 10000], [5, 8, 13], mixed([20000, 20000, 10000], 8000, 6000, 10**9, 500)),
        text([0, 0, 1], [1, 1, 1], mixed([0, 0, 1], 2000, 3, 10**5)),
    ],
}))
