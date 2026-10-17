import json
import random

rng = random.Random(20261105)


def text(ops):
    return f"{len(ops)}\n" + "\n".join(ops) + "\n"


def equal(payer, amount, people):
    return f"expense {payer} {amount} EQUAL {len(people)} " + " ".join(people)


def valued(kind, payer, amount, pairs):
    return f"expense {payer} {amount} {kind} {len(pairs)} " + " ".join(f"{p} {v}" for p, v in pairs)


def cuts(total, k):
    """k non-negative integers adding up to total."""
    marks = sorted(rng.randint(0, total) for _ in range(k - 1))
    return [b - a for a, b in zip([0] + marks, marks + [total])]


def ledger(names, q, amax, settle_every):
    ops = []
    while len(ops) < q:
        if settle_every and len(ops) % settle_every == settle_every - 1:
            ops.append("settle")
            continue
        payer = rng.choice(names)
        people = rng.sample(names, rng.randint(1, min(6, len(names))))
        amount = rng.randint(1, amax)
        r = rng.random()
        if r < 0.35:
            ops.append(equal(payer, amount, people))
        elif r < 0.55:
            shares = cuts(amount, len(people))
            if rng.random() < 0.1:
                shares[0] += rng.choice([-1, 1]) if shares[0] else 1  # off by a cent: INVALID
            ops.append(valued("EXACT", payer, amount, list(zip(people, shares))))
        elif r < 0.75:
            bps = cuts(10000, len(people))
            if rng.random() < 0.1:
                bps[-1] += 1
            ops.append(valued("PERCENT", payer, amount, list(zip(people, bps))))
        elif r < 0.85:
            a, b = rng.sample(names, 2)
            ops.append(f"pay {a} {b} {rng.randint(1, amax)}")
        else:
            ops.append(f"balance {rng.choice(names + ['nobody'])}")
    return ops + ["settle"]


sample = text([
    equal("ann", 10000, ["ann", "bob", "cat"]), valued("EXACT", "bob", 3000, [("ann", 1000), ("cat", 2000)]),
    valued("PERCENT", "cat", 1001, [("ann", 3333), ("bob", 3333), ("cat", 3334)]),
    valued("EXACT", "ann", 500, [("bob", 300), ("cat", 300)]), "balance ann", "balance bob", "balance cat",
    "balance dan", "settle", "pay cat ann 3000", "balance cat", "settle",
])
# Rounding: 1 cent three ways, 100 cents at 33.33% each, and a 0% share; ties in settle go by name.
rounding = text([
    equal("a", 1, ["a", "b", "c"]), equal("z", 2, ["c", "b", "a"]),
    valued("PERCENT", "a", 100, [("b", 3333), ("c", 3333), ("d", 3334)]),
    valued("PERCENT", "b", 7, [("a", 0), ("c", 5000), ("d", 5000)]),
    valued("PERCENT", "c", 1, [("a", 2500), ("b", 2500), ("d", 5000)]),
    valued("PERCENT", "c", 3, [("a", 9999), ("b", 1)]), valued("PERCENT", "c", 3, [("a", 9999), ("b", 2)]),
    "settle", "pay b a 1000", "settle",
    equal("p", 300, ["q", "r", "s"]), "settle", equal("q", 300, ["p"]), "settle",
])
# Large amounts: shares and balances past 2^31 and amount × basis points past 2^40.
big = text([
    equal("x", 10**9, ["y"]), equal("x", 10**9, ["y"]), equal("x", 10**9, ["y", "z"]),
    valued("PERCENT", "y", 10**9, [("x", 1), ("z", 9999)]), valued("EXACT", "z", 10**9, [("x", 10**9)]),
    "balance x", "balance y", "balance z", "settle",
] + [equal("w", 10**9, ["x", "y", "z"]) for _ in range(5)] + ["balance w", "settle"])
# Everyone even: nothing to settle; self-payments cancel out.
even = text([equal("a", 900, ["a", "b", "c"]), "pay b a 300", "pay c a 300", "settle", "pay a a 50",
             equal("b", 5, ["b"]), "balance a", "balance b", "settle"])
names = [f"u{k:02d}" for k in range(40)]

print(json.dumps({
    "samples": [sample],
    "tests": [rounding, big, even, text(ledger(["ann", "bob", "cat", "dan"], 300, 5000, 25)),
              text(ledger(names, 2000, 10**6, 250)), text(ledger(names[:12], 2000, 10**9, 0))],
}))
