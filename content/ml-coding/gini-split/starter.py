import numpy as np


def gini(y: np.ndarray, c: int) -> float:
    """1 - Σ p_k²，p_k 是第 k 类的占比 / 1 - Σ p_k², p_k being class k's share."""
    return 0.0  # TODO


def best_split(X: np.ndarray, y: np.ndarray, c: int):
    """加权 Gini 最小的切分 (特征下标, 阈值, 加权 Gini)；x <= 阈值的样本进左边。
    The split with the lowest weighted Gini: (feature, threshold, weighted Gini); x <= threshold goes left."""
    return 0, 0.0, 0.0  # TODO


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = sys.stdin.read().split()
    n, d, c = int(data[0]), int(data[1]), int(data[2])
    rows = np.array([int(v) for v in data[3:3 + n * (d + 1)]], dtype=np.int64).reshape(n, d + 1)
    X, y = rows[:, :d], rows[:, d]
    feature, threshold, weighted = best_split(X, y, c)
    out = [gini(y, c), feature, threshold, weighted]
    print(len(out))
    print(" ".join("%.6f" % float(v) for v in out))


main()
