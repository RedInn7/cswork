import json
import random

rng = random.Random(20261017)
LETTERS = "abcdefghijklmnopqrstuvwxyz"


def word():
    return "".join(rng.choice(LETTERS) for _ in range(rng.randint(1, 6)))


def text(seed, rounds):
    return f"{seed} {len(rounds)}\n" + "\n".join(" ".join(map(str, r)) for r in rounds) + "\n"


sample = text(5, [[3, "tick", "tock"], [1, "ping", "pong"], [4, "in", "out"]])
# One turn each, over and over: the start order alone decides who goes first.
single = text(3, [[1, "foo", "bar"] for _ in range(80)])
# The same word on both sides: only the counts and the alternation show.
same = text(9, [[rng.randint(1, 30), "x", "x"] if k % 3 == 0 else [rng.randint(1, 30), "x", "y"] for k in range(30)])
tests = [single, same] + [text(rng.randrange(10**9), [[rng.randint(1, 40), word(), word()] for _ in range(n)])
                          for n in (30, 40)]
print(json.dumps({"samples": [sample], "tests": tests}))
