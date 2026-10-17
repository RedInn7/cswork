import json
import random

rng = random.Random(20261023)


def text(lr, lam, epochs, train, query):
    d = len(query[0])
    head = f"{len(train)} {d} {len(query)} {lr} {lam} {epochs}\n"
    return head + "".join(" ".join(x + [str(label)]) + "\n" for x, label in train) + "".join(" ".join(q) + "\n" for q in query)


def case(n, d, m, lr, lam, epochs, noise, scale=300):
    """Features in hundredths; the label is a noisy integer linear score's sign."""
    w = [rng.randint(-300, 300) for _ in range(d)]
    b = rng.randint(-20000, 20000)
    fmt = lambda v: f"{v / 100:.2f}"
    train = []
    for _ in range(n):
        x = [rng.randint(-scale, scale) for _ in range(d)]
        score = sum(a * c for a, c in zip(w, x)) + b + rng.randint(-noise, noise)
        train.append(([fmt(v) for v in x], int(score > 0)))
    query = [[fmt(rng.randint(-scale, scale)) for _ in range(d)] for _ in range(m)]
    return text(lr, lam, epochs, train, query)


sample = "4 1 3 0.5 0 1\n0 0\n1 0\n2 1\n3 1\n0\n2\n4\n"

print(json.dumps({
    "samples": [sample],
    "tests": [case(2, 1, 2, "0.1", 0, 1, 0), case(20, 2, 10, "0.5", 0, 50, 0), case(100, 3, 20, "0.1", "0.01", 200, 30000),
              case(300, 4, 50, "1", "0.1", 300, 50000), case(500, 6, 100, "0.05", "0.001", 300, 80000),
              case(200, 5, 30, "0.3", "1.5", 150, 100000, scale=100)],
}))
