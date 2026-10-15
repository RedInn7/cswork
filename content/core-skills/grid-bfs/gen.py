import json
import random

rng = random.Random(20261026)


def text(rows):
    return f"{len(rows)} {len(rows[0])}\n" + "\n".join(rows) + "\n"


def random_grid(r, c, wall):
    g = [["#" if rng.random() < wall else "." for _ in range(c)] for _ in range(r)]
    cells = rng.sample(range(r * c), 2)
    for cell, mark in zip(cells, "ST"):
        g[cell // c][cell % c] = mark
    return ["".join(row) for row in g]


def serpentine(r, c):
    """Walls with one gap per row, alternating ends: the path snakes through every row."""
    g = [["."] * c for _ in range(r)]
    for i in range(1, r, 2):
        for j in range(c):
            g[i][j] = "#"
        g[i][c - 1 if i % 4 == 1 else 0] = "."
    g[0][0], g[r - 1][c - 1 if (r - 1) % 4 == 0 else 0] = "S", "T"
    return ["".join(row) for row in g]


sample = text(["S....", ".###.", "...#.", ".#...", ".#..T"])

print(json.dumps({
    "samples": [sample],
    "tests": [text(["ST"]), text(["S#T"]), text(["S", ".", "T"]), text(["S.#", "##.", "..T"]),
              text(random_grid(10, 10, 0.25)), text(random_grid(50, 80, 0.3)), text(serpentine(199, 300)),
              text(random_grid(300, 300, 0.2)), text(random_grid(300, 300, 0.45)),
              text(["S" + "." * 298 + "T"])],
}))
