import json
import random

rng = random.Random(20261108)


def text(types, ops):
    return f"{len(types)}\n" + "".join(f"{n} {c} {b} {w}\n" for n, c, b, w in types) + f"{len(ops)}\n" + "\n".join(ops) + "\n"


def season(types, q, horizon, stay):
    """Bookings over a horizon of days, cancellations (some late, some repeated) and availability checks."""
    names = [t[0] for t in types]
    ops, made = [], 0
    while len(ops) < q:
        r = rng.random()
        if r < 0.55:
            a = rng.randint(0, horizon)
            b = a + rng.choice([rng.randint(1, stay)] * 9 + [0, 31, -1])
            ops.append(f"book {rng.choice(names)} {a} {max(0, min(b, 99999))}")
            made += 1
        elif r < 0.75:
            ops.append(f"cancel {rng.randint(0, horizon)} {rng.randint(1, made + 1)}")
        else:
            ops.append(f"free {rng.choice(names)} {rng.randint(0, horizon + stay)}")
    return ops


hotel = [("std", 2, 100, 150), ("suite", 1, 300, 420)]
sample = text(hotel, [
    "book std 3 6", "book std 4 5", "book std 4 8", "free std 4", "free std 7", "book suite 10 10", "cancel 2 2",
    "book std 4 8", "cancel 3 1", "cancel 3 3", "cancel 3 3", "free std 4", "book suite 0 7", "free suite 6",
])
# Back-to-back stays share no night; the last night before check-out is the one that counts; 30 nights fit, 31 do not.
edge = text([("r", 1, 10, 11)], [
    "book r 0 1", "book r 1 2", "book r 0 2", "free r 0", "free r 1", "free r 2", "book r 2 32", "book r 40 71",
    "book r 40 70", "cancel 40 4", "cancel 39 4", "cancel 39 4", "free r 50", "book r 99969 99999", "free r 99998", "cancel 0 99",
    "cancel 0 0", "book r 5 3",
])
# Weekend nights: day 4 is a Friday, day 5 a Saturday; a week from Monday costs 5 weekday and 2 weekend nights.
weeks = text([("w", 3, 1000, 1500)], [f"book w {d} {d + 1}" for d in range(14)] + ["book w 0 7", "book w 7 14",
             "book w 3 10", "free w 9", "book w 14 44", "free w 30"])
types = [("std", 40, 120, 180), ("dbl", 20, 160, 230), ("suite", 5, 400, 650), ("loft", 1, 900, 999)]

print(json.dumps({
    "samples": [sample],
    "tests": [edge, weeks, text(hotel, season(hotel, 400, 30, 5)), text(types, season(types, 4000, 120, 7)),
              text(types, season(types, 4000, 99000, 30)), text([("solo", 1, 1, 2)], season([("solo", 1, 1, 2)], 2000, 60, 3))],
}))
