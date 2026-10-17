import json
import random

rng = random.Random(20261106)


def text(seats, ttl, ops):
    return f"{seats} {ttl}\n{len(ops)}\n" + "\n".join(ops) + "\n"


def rush(seats, ttl, q, users, k, step, tmax=10**9):
    """Users grab seats, then mostly pay for their own holds; some confirms are late, stale or someone else's.

    The generator tracks which holds succeed (all or nothing, expiry at t + ttl) only to aim its confirms."""
    ops, t, owner, holds = [], 0, {}, []  # owner: seat -> hold index; holds: [user, seats, expires, open]
    while len(ops) < q:
        t = min(tmax, t + rng.randint(0, step))
        for h in holds:
            if h[3] and h[2] <= t:
                h[3] = False
                for x in h[1]:
                    owner.pop(x, None)
        r = rng.random()
        user = f"u{rng.randrange(users)}"
        if r < 0.45:
            chosen = rng.sample(range(1, seats + 1), min(seats, rng.randint(1, k)))
            ops.append(f"hold {t} {user} {len(chosen)} " + " ".join(map(str, chosen)))
            if all(x not in owner for x in chosen):
                holds.append([user, chosen, t + ttl, True])
                for x in chosen:
                    owner[x] = len(holds)
        elif r < 0.8 and holds:
            j = rng.randint(max(1, len(holds) - 8), len(holds))  # a recent hold, by id
            who = holds[j - 1][0] if rng.random() < 0.85 else user
            op = "confirm" if rng.random() < 0.75 else "release"
            hold_id = j if rng.random() < 0.95 else len(holds) + 1
            ops.append(f"{op} {t} {hold_id} {who}")
            if hold_id == j and who == holds[j - 1][0] and holds[j - 1][3]:
                holds[j - 1][3] = False  # booked or released: no longer expires
                if op == "release":
                    for x in holds[j - 1][1]:
                        owner.pop(x, None)
        elif r < 0.9:
            ops.append(f"free {t}")
        else:
            ops.append(f"seat {t} {rng.randint(1, seats)}")
    return ops


sample = text(6, 10, [
    "hold 0 amy 2 1 2", "hold 1 bo 2 2 3", "hold 1 bo 1 3", "free 2", "confirm 5 1 bo", "confirm 5 1 amy",
    "seat 6 1", "seat 6 3", "release 8 2 bo", "hold 9 cy 1 3", "confirm 20 3 cy", "seat 20 3", "free 20",
    "release 20 3 cy",
])
# Expiry is exclusive of nothing: a hold made at 0 with TTL 5 is gone at 5, not at 6. Release then re-hold,
# confirm twice, release a booking, and a hold of more than 10 seats.
edge = text(12, 5, [
    "hold 0 a 3 1 2 3", "seat 4 2", "confirm 5 1 a", "seat 5 2", "hold 5 b 3 3 2 1", "release 9 2 b",
    "release 9 2 b", "confirm 9 2 b", "hold 9 c 11 1 2 3 4 5 6 7 8 9 10 11", "hold 9 c 10 1 2 3 4 5 6 7 8 9 10",
    "confirm 13 4 c", "confirm 13 4 c", "release 13 4 c", "free 13", "hold 13 d 3 10 11 12", "free 13",
    "hold 17 e 2 12 11", "free 18", "seat 18 12", "confirm 18 0 e", "release 18 99 e",
])
# Huge times: t + TTL near 2 × 10^9.
late = text(3, 10**9, ["hold 999999999 a 1 1", "free 1000000000", "hold 1000000000 b 2 1 2", "seat 1000000000 1",
                       "confirm 1000000000 1 a", "free 1000000000", "seat 1000000000 1"])
# Many holds expiring at the same moment.
wave = ["hold 0 w%d 1 %d" % (s, s) for s in range(1, 51)] + ["free 99", "free 100"]
wave += ["hold 100 x 10 " + " ".join(map(str, range(s, s + 10))) for s in range(1, 51, 10)] + ["confirm 150 51 x", "free 200"]

print(json.dumps({
    "samples": [sample],
    "tests": [edge, late, text(50, 100, wave), text(20, 30, rush(20, 30, 400, 6, 2, 3)),
              text(200, 50, rush(200, 50, 4000, 40, 4, 2)), text(100000, 600, rush(100000, 600, 3000, 500, 10, 20))],
}))
