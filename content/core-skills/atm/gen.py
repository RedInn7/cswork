import json
import random

rng = random.Random(20261104)


def text(counts, accounts, ops):
    head = " ".join(map(str, counts)) + f"\n{len(accounts)}\n"
    head += "".join(f"{card} {pin} {balance}\n" for card, pin, balance in accounts)
    return head + f"{len(ops)}\n" + "\n".join(ops) + "\n"


def visits(accounts, n, amounts):
    """n visits: a card (sometimes an unknown one), PIN tries, then balance checks and withdrawals."""
    ops = []
    for _ in range(n):
        card, pin, _ = rng.choice(accounts)
        ops.append(f"insert {card if rng.random() < 0.95 else 'ghost'}")
        for _ in range(rng.choice([0, 1, 1, 1, 2, 3])):
            ops.append(f"pin {pin if rng.random() < 0.7 else str(rng.randint(0, 9999)).zfill(4)}")
        for _ in range(rng.randint(0, 3)):
            r = rng.random()
            ops.append("balance" if r < 0.3 else "cash" if r < 0.4 else f"withdraw {rng.choice(amounts)}")
        if rng.random() < 0.9:
            ops.append("eject")
    return ops


people = [("alice", "1234", 5000), ("bob", "0007", 120), ("carol", "9999", 10**9)]
sample = text([10, 4, 2], people, [
    "balance", "insert dave", "insert bob", "insert alice", "pin 7", "pin 0000", "balance", "pin 0007", "pin 0007",
    "balance", "withdraw 130", "withdraw 75", "withdraw 120", "balance", "eject", "eject", "insert alice", "pin 1111",
    "eject", "insert alice", "pin 2222", "pin 3333", "insert alice", "cash",
])
# Withdrawals the cassettes can or cannot pay, the per-withdrawal limit, and a correct PIN that resets the count.
edge = text([5, 2, 3], people, [
    "insert carol", "pin 9999", "withdraw 0", "withdraw -10", "withdraw 2010", "withdraw 2000", "withdraw 280",
    "cash", "withdraw 270", "withdraw 160", "withdraw 50", "cash", "withdraw 30", "withdraw 10", "cash", "eject",
    "insert bob", "pin 1", "pin 2", "eject", "insert bob", "pin 0007", "eject", "insert bob", "pin 3", "pin 4",
    "pin 0007", "withdraw 10", "balance", "eject", "withdraw 10", "pin 0007",
])
# No 10s at all: 40 cannot be paid, 50 can; greedy takes 100s before 50s.
no_tens = text([0, 6, 5], [("x1", "4321", 3000)], [
    "insert x1", "pin 4321", "withdraw 40", "withdraw 50", "withdraw 450", "cash", "withdraw 600", "withdraw 300",
    "withdraw 100", "cash", "balance",
])
crowd = [(f"u{k}", str(rng.randint(0, 9999)).zfill(4), rng.randint(0, 3000) // 10 * 10) for k in range(30)]
rich = [(f"r{k}", str(rng.randint(0, 9999)).zfill(4), rng.randint(10**6, 10**9)) for k in range(200)]

print(json.dumps({
    "samples": [sample],
    "tests": [
        edge, no_tens,
        text([20, 10, 10], crowd, visits(crowd, 150, [10, 20, 30, 40, 60, 80, 150, 170, 500, 990, 3000, 15, 0])),
        text([500, 200, 300], crowd + rich, visits(crowd + rich, 1500, [k * 10 for k in range(1, 201)] + [7, 2001])),
        text([10**4, 10**4, 10**4], rich, visits(rich, 1500, [k * 10 for k in range(150, 201)])),
    ],
}))
