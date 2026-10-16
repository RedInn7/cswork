import json
import random

rng = random.Random(20261016)
LETTERS = "abcdefghijklmnopqrstuvwxyz"


def word():
    return "".join(rng.choice(LETTERS) for _ in range(rng.randint(1, 8)))


def text(seed, rounds):
    return f"{seed} {len(rounds)}\n" + "\n".join(" ".join(r) for r in rounds) + "\n"


sample = text(7, [["wake", "wash", "work"], ["ready", "set", "go"], ["one", "two", "three"],
                  ["mix", "bake", "eat"]])
# Repeated words: only the order of the three jobs can tell them apart.
same = text(11, [["a", "a", "b"] if k % 2 else ["x", "y", "x"] for k in range(60)])
tests = [same] + [text(rng.randrange(10**9), [[word(), word(), word()] for _ in range(n)]) for n in (40, 80, 100)]
print(json.dumps({"samples": [sample], "tests": tests}))
