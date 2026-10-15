import json
import random

rng = random.Random(20261031)


def text(w):
    return f"{len(w)}\n" + "".join(" ".join(map(str, row)) + "\n" for row in w)


def matrix(n, density, wmax, connected=True):
    w = [[0 if i == j else -1 for j in range(n)] for i in range(n)]

    def link(i, j):
        w[i][j] = w[j][i] = rng.randint(1, wmax)

    if connected:
        order = list(range(n))
        rng.shuffle(order)
        for k in range(1, n):
            link(order[k], order[rng.randrange(k)])
    for i in range(n):
        for j in range(i + 1, n):
            if rng.random() < density:
                link(i, j)
    return w


sample = text([[0, 2, 6, 5], [2, 0, 3, -1], [6, 3, 0, 1], [5, -1, 1, 0]])
split = matrix(6, 0.0, 5, False)
split[0][1] = split[1][0] = 4
split[2][3] = split[3][2] = 1
# Equal keys everywhere: the order is decided by node numbers alone.
flat = [[0 if i == j else 7 for j in range(8)] for i in range(8)]

print(json.dumps({
    "samples": [sample],
    "tests": [text([[0]]), text([[0, -1], [-1, 0]]), text([[0, 9], [9, 0]]), text(split), text(flat),
              text(matrix(12, 0.3, 3)), text(matrix(40, 0.2, 1000)), text(matrix(150, 0.6, 1000)),
              text(matrix(200, 0.05, 50)), text(matrix(120, 0.02, 9, False))],
}))
