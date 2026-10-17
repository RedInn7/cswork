import numpy as np

EPS = 1e-15


def log_loss(y: np.ndarray, probs: np.ndarray) -> float:
    """多分类交叉熵：真实类别的概率先截断到 [EPS, 1 - EPS]，再取 -log 的平均。
    Multiclass cross-entropy: clip each true-class probability to [EPS, 1 - EPS], then average -log."""
    return 0.0  # TODO


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = sys.stdin.read().split()
    t, at = int(data[0]), 1
    out = []
    for _ in range(t):
        n, k = int(data[at]), int(data[at + 1])
        rows = np.array([float(v) for v in data[at + 2:at + 2 + n * (k + 1)]]).reshape(n, k + 1)
        at += 2 + n * (k + 1)
        out.append(float(log_loss(rows[:, 0].astype(np.int64), rows[:, 1:])))
    print(len(out))
    print(" ".join("%.6f" % v for v in out))


main()
