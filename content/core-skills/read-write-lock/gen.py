import json
import random

rng = random.Random(20261022)


def text(seed, rounds):
    return f"{seed} {len(rounds)}\n" + "\n".join(rounds) + "\n"


def mix(readers, writers, ops):
    return " ".join(map(str, ["mix", readers, writers, ops] + [rng.randint(1, 9) for _ in range(writers)]))


def rounds(count):
    # One hold round per test: a correct lock keeps its probes waiting for 0.2 s.
    out = ["hold"] + [f"share {rng.randint(2, 6)}" for _ in range(count // 4)]
    while len(out) < count:
        writers = rng.randint(0, 3)
        out.append(mix(rng.randint(0 if writers else 1, 8 - writers), writers, rng.randint(1, 12)))
    rng.shuffle(out)
    return out


sample = text(2, ["hold", "share 3", "mix 2 2 3 4 5"])
# Writers only, then readers only: exclusion among writers and sharing among readers.
lanes = text(10, [mix(0, rng.randint(2, 4), 10) for _ in range(8)] + [f"share {n}" for n in (2, 4, 6, 8)] + ["hold"])
tests = [lanes, text(rng.randrange(10**9), rounds(20)), text(rng.randrange(10**9), rounds(30))]
print(json.dumps({"samples": [sample], "tests": tests}))
