import json
import random

rng = random.Random(20261019)


def atoms(k):
    s = list("HHO" * k)
    rng.shuffle(s)
    return "".join(s)


def text(seed, rounds):
    return f"{seed} {len(rounds)}\n" + "\n".join(rounds) + "\n"


sample = text(6, ["HOH", "OOHHHH", "HHHHHHOOO"])
# Every oxygen first, then every hydrogen, and the other way round.
lopsided = text(2, ["O" * k + "H" * (2 * k) if k % 2 else "H" * (2 * k) + "O" * k for k in range(1, 7)] * 6)
tests = [lopsided] + [text(rng.randrange(10**9), [atoms(rng.randint(1, hi)) for _ in range(n)])
                      for n, hi in ((60, 2), (40, 6), (30, 6))]
print(json.dumps({"samples": [sample], "tests": tests}))
