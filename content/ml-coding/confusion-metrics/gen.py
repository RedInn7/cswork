import json
import random

rng = random.Random(20261017)


def text(k, y_true, y_pred):
    return f"{len(y_true)} {k}\n{' '.join(map(str, y_true))}\n{' '.join(map(str, y_pred))}\n"


def case(n, k, right, present=None, predicted=None):
    """Labels from `present`; a prediction is right with chance right/100, else any of `predicted`."""
    present = present or list(range(k))
    predicted = predicted or list(range(k))
    y_true = [rng.choice(present) for _ in range(n)]
    y_pred = [t if t in predicted and rng.randint(1, 100) <= right else rng.choice(predicted) for t in y_true]
    return text(k, y_true, y_pred)


sample = text(3, [0, 0, 1, 1, 1, 2, 2, 2], [0, 1, 1, 1, 2, 2, 0, 2])
perfect = text(4, [0, 1, 2, 3, 3, 2], [0, 1, 2, 3, 3, 2])
# Class 3 never occurs and class 4 is never predicted: their scores are 0, and they still count in macro-F1.
absent = case(40, 5, 60, present=[0, 1, 2, 4], predicted=[0, 1, 2, 3])
all_wrong = text(2, [0, 0, 1, 1], [1, 1, 0, 0])

print(json.dumps({
    "samples": [sample],
    "tests": [perfect, absent, all_wrong, case(1, 2, 50), case(200, 3, 70), case(5000, 10, 55), case(20000, 20, 40)],
}))
