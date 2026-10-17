import json
import random

rng = random.Random(20261028)


def text(docs, pairs):
    lines = [f"{len(docs)} {len(pairs)}"] + [f"{len(d)} {' '.join(d)}" for d in docs] + [f"{i} {j}" for i, j in pairs]
    return "\n".join(lines) + "\n"


def vocabulary(size):
    words = set()
    while len(words) < size:
        words.add("".join(rng.choice("abcdefghijklmnopqrstuvwxyz") for _ in range(rng.randint(2, 8))))
    return sorted(words)


def corpus(n, q, size, longest):
    """Word i drawn with weight ~ 1/(i+1): a few common words, a long tail."""
    words = vocabulary(size)
    weights = [10 ** 6 // (i + 1) for i in range(size)]
    docs = [rng.choices(words, weights, k=rng.randint(1, longest)) for _ in range(n)]
    pairs = [(rng.randrange(n), rng.randrange(n)) for _ in range(q)]
    return text(docs, pairs)


sample = text([["the", "cat", "sat"], ["the", "dog", "sat"], ["the", "cat", "ate", "the", "fish"]], [(0, 1), (0, 2), (1, 2), (2, 2)])
# A word in every document has idf 1, never 0; a document of one repeated word is a unit vector; no shared word: 0.
edges = text([["a", "a", "a"], ["a"], ["b", "c"], ["a", "b", "c", "c"], ["z"]], [(0, 1), (0, 2), (2, 3), (3, 3), (4, 0), (1, 3)])

print(json.dumps({
    "samples": [sample],
    "tests": [edges, corpus(10, 20, 15, 6), corpus(100, 200, 300, 30), corpus(300, 500, 2000, 50), corpus(50, 100, 10, 50)],
}))
