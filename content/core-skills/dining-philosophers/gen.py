import json
import random

rng = random.Random(20261020)


def text(seed, rounds):
    return f"{seed} {len(rounds)}\n" + "\n".join(" ".join(map(str, [len(m)] + m)) for m in rounds) + "\n"


sample = text(3, [[1, 1, 1, 1, 1], [3, 2], [0, 2, 1]])
# Two or three at the table and everyone hungry: where a careless lock order deadlocks.
crowded = text(12, [[rng.randint(2, 6) for _ in range(rng.randint(2, 3))] for _ in range(40)])
tests = [crowded,
         text(rng.randrange(10**9), [[rng.randint(0, 6) for _ in range(rng.randint(2, 7))] for _ in range(25)]),
         text(rng.randrange(10**9), [[8] * 5 for _ in range(12)])]
print(json.dumps({"samples": [sample], "tests": tests}))
