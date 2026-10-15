import json
import random

rng = random.Random(20261102)


def text(ops):
    return f"{len(ops)}\n" + "\n".join(ops) + "\n"


def mixed(q, vocabulary):
    """Operations over a vocabulary of related words, so prefixes overlap and erases often hit."""
    ops = []
    for _ in range(q):
        w = rng.choice(vocabulary)
        r = rng.random()
        if r < 0.4:
            ops.append(f"insert {w}")
        elif r < 0.55:
            ops.append(f"erase {w}")
        elif r < 0.75:
            ops.append(f"search {w}")
        else:
            ops.append(f"prefix {w[:rng.randint(1, len(w))]}")
    return ops


def vocabulary(size, alphabet, low, high):
    stems = ["".join(rng.choice(alphabet) for _ in range(rng.randint(low, high))) for _ in range(size // 4 + 1)]
    words = {s[:rng.randint(1, len(s))] for s in stems for _ in range(4)} | set(stems)
    return sorted(words)


sample = text(["insert apple", "insert app", "insert apple", "prefix app", "prefix apple", "search ap",
               "erase apple", "search apple", "erase apple", "erase apple", "search apple", "search app",
               "prefix a"])
edges = text(["search a", "erase a", "prefix a", "insert a", "insert a", "prefix a", "erase a", "search a",
              "erase a", "search a", "prefix a", "insert ab", "search a", "prefix a", "erase ab", "prefix a",
              "insert " + "z" * 20, "prefix " + "z" * 19, "search " + "z" * 19, "prefix " + "z" * 20])

print(json.dumps({
    "samples": [sample],
    "tests": [edges, text(mixed(300, vocabulary(30, "ab", 1, 6))), text(mixed(3000, vocabulary(400, "abc", 2, 12))),
              text(mixed(8000, vocabulary(3000, "abcdefghijklmnopqrstuvwxyz", 3, 20))),
              text(mixed(8000, vocabulary(200, "ab", 10, 20)))],
}))
