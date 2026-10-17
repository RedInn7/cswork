import json
import random

rng = random.Random(20261107)


class Codes:
    """The statement's code generator, so the tests can type real codes."""

    def __init__(self, seed):
        self.x = seed

    def next(self):
        self.x = (self.x * 1103515245 + 12345) % 2147483648
        return f"{self.x % 1000000:06d}"


def text(counts, keep, seed, ops):
    return f"{counts[0]} {counts[1]} {counts[2]} {keep} {seed}\n{len(ops)}\n" + "\n".join(ops) + "\n"


def traffic(counts, keep, seed, q, step, typo):
    """Couriers deliver, customers pick up with real codes (some typos and guesses), returns and free queries.

    The generator follows the station (compartments, expiry, codes, lockout) only to type codes that exist."""
    codes, free, ops, t, n = Codes(seed), list(counts), [], 0, 0
    active = {}  # code -> (compartment size, deadline)
    failures, locked_until = 0, -1
    while len(ops) < q:
        t += rng.randint(0, step)
        for code, (size, deadline) in list(active.items()):
            if deadline <= t:
                del active[code]
                free[size] += 1
        r = rng.random()
        if r < 0.45:
            n += 1
            need = rng.choice([0, 0, 0, 1, 1, 2])
            ops.append(f"deliver {t} p{n} {'SML'[need]}")
            size = next((s for s in range(need, 3) if free[s]), None)
            if size is not None:
                free[size] -= 1
                code = codes.next()
                while code in active:
                    code = codes.next()
                active[code] = (size, t + keep)
        elif r < 0.8 and active:
            code = rng.choice(sorted(active))
            if rng.random() < typo:
                code = rng.choice([code[:-1] + str((int(code[-1]) + 1) % 10), code.lstrip("0") or "0",
                                   str(rng.randrange(10**6)).zfill(6)])
            ops.append(f"pickup {t} {code}")
            if t < locked_until:
                continue
            if code in active:
                free[active.pop(code)[0]] += 1
                failures = 0
            else:
                failures += 1
                if failures == 5:
                    failures, locked_until = 0, t + 30
        elif r < 0.9:
            ops.append(f"returns {t}")
        else:
            ops.append(f"free {t} {rng.choice('SML')}")
    return ops


codes = Codes(42)
c = [codes.next() for _ in range(4)]
sample = text([1, 1, 1], 100, 42, [
    f"deliver 0 book S", f"deliver 0 lamp S", f"deliver 5 desk L", f"deliver 6 mug M", f"free 6 S",
    f"pickup 10 {c[0]}", f"pickup 10 {c[0]}", f"free 10 S", f"returns 99", f"returns 105", f"pickup 105 {c[1]}",
    f"free 105 M", f"returns 105",
])
codes = Codes(7)
e = [codes.next() for _ in range(3)]
# Five wrong codes lock the keypad for 30: even the right code is refused until then, and the lock does not count.
# Codes compare as six-digit strings; a parcel expires exactly at delivery time + keep.
lockout = text([2, 0, 1], 50, 7, [
    "deliver 0 a S", "deliver 0 b S", "deliver 0 c S", "deliver 0 d S", "pickup 1 000000", "pickup 1 1", "pickup 2 999999",
    f"pickup 3 {e[0][:5]}", f"pickup 4 {e[1]}", "pickup 5 123456", "pickup 6 111111", "pickup 7 222222", "pickup 8 333333",
    "pickup 9 444444", f"pickup 9 {e[0]}", f"pickup 38 {e[0]}", f"pickup 39 {e[0]}", "free 39 S", "returns 49",
    "returns 50", f"pickup 50 {e[2]}", "free 50 L", "returns 50",
])
# Code collisions: a tiny code space would repeat, so the generator must redraw while a code is in use.
crowd = text([300, 200, 100], 10**9, 2024, [f"deliver {k} q{k} {'SML'[k % 3]}" for k in range(700)] + ["free 700 S"])

print(json.dumps({
    "samples": [sample],
    "tests": [
        lockout, crowd,
        text([3, 2, 1], 40, 99, traffic([3, 2, 1], 40, 99, 300, 3, 0.1)),
        text([50, 30, 20], 500, 123456, traffic([50, 30, 20], 500, 123456, 4000, 2, 0.05)),
        text([2000, 1000, 500], 4320, 31337, traffic([2000, 1000, 500], 4320, 31337, 4000, 5, 0.02)),
        text([1, 0, 0], 10, 5, traffic([1, 0, 0], 10, 5, 500, 4, 0.3)),
    ],
}))
