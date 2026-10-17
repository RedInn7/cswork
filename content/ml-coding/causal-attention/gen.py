import json
import random

rng = random.Random(20261026)


def text(causal, Q, K, V):
    head = f"{len(Q)} {len(Q[0])} {len(V[0])} {causal}\n"
    return head + "".join(" ".join(map(str, row)) + "\n" for row in Q + K + V)


def matrix(rows, cols, bound, scale=100):
    return [[f"{rng.randint(-bound, bound) / scale:.2f}" for _ in range(cols)] for _ in range(rows)]


def case(t, dk, dv, causal, bound):
    return text(causal, matrix(t, dk, bound), matrix(t, dk, bound), matrix(t, dv, 300))


sample = text(1, [[1, 0], [0, 1], [1, 1]], [[1, 0], [0, 1], [1, 1]], [[1, 0], [0, 1], [2, 2]])
# Scores in the thousands: exp without the max shift overflows.
loud = case(6, 4, 3, 1, 3000)
one = text(1, [[5]], [[-7]], [[2.5, -3]])
# The same input without and with the mask: row i of the causal output only mixes V[0..i].
both = matrix(8, 3, 200), matrix(8, 3, 200), matrix(8, 2, 300)

print(json.dumps({
    "samples": [sample],
    "tests": [loud, one, text(0, *both), text(1, *both), case(16, 8, 8, 1, 150), case(48, 16, 16, 1, 100),
              case(40, 4, 12, 0, 400)],
}))
