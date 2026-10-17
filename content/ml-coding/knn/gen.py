import json
import random

rng = random.Random(20261020)


def text(k, train, query):
    d = len(query[0])
    lines = [f"{len(train)} {len(query)} {d} {k}"]
    lines += [" ".join(map(str, x + [label])) for x, label in train]
    lines += [" ".join(map(str, q)) for q in query]
    return "\n".join(lines) + "\n"


def blobs(n, m, d, k, classes, spread, noise):
    """Class centers on a small integer grid, points around them: distance ties are common."""
    centers = [[rng.randint(-spread, spread) for _ in range(d)] for _ in range(classes)]
    train = []
    for _ in range(n):
        label = rng.randrange(classes)
        train.append(([c + rng.randint(-noise, noise) for c in centers[label]], label))
    query = [[rng.randint(-spread - noise, spread + noise) for _ in range(d)] for _ in range(m)]
    return text(k, train, query)


sample = text(3, [([0, 0], 0), ([1, 0], 0), ([0, 1], 1), ([5, 5], 1), ([6, 5], 2)], [[0, 0], [5, 4], [3, 3]])
# Equal distances: the lower index is nearer. Equal votes: the smaller class.
ties_index = text(2, [([1, 0], 2), ([0, 1], 0), ([-1, 0], 1), ([0, -1], 1)], [[0, 0], [0, -5], [-5, 0]])
ties_vote = text(4, [([1, 0], 2), ([0, 1], 0), ([-1, 0], 2), ([0, -1], 0), ([3, 3], 1)], [[0, 0], [1, 1], [4, 4]])
one = text(1, [([3], 1), ([7], 0)], [[5], [4], [6], [-10], [100]])
everyone = text(5, [([i], i % 3) for i in range(5)], [[2], [-1], [9]])

print(json.dumps({
    "samples": [sample],
    "tests": [ties_index, ties_vote, one, everyone, blobs(30, 20, 2, 3, 3, 3, 1), blobs(200, 100, 3, 5, 4, 6, 2),
              blobs(1500, 200, 5, 7, 6, 20, 4), blobs(2000, 150, 8, 15, 10, 50, 10)],
}))
