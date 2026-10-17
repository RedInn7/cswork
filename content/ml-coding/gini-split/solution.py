import numpy as np


def gini(y: np.ndarray, c: int) -> float:
    """1 - Σ p_k²，p_k 是第 k 类的占比 / 1 - Σ p_k², p_k being class k's share."""
    p = np.bincount(y, minlength=c) / len(y)
    return float(1 - (p ** 2).sum())


def best_split(X: np.ndarray, y: np.ndarray, c: int):
    """加权 Gini 最小的切分 (特征下标, 阈值, 加权 Gini)；x <= 阈值的样本进左边。
    The split with the lowest weighted Gini: (feature, threshold, weighted Gini); x <= threshold goes left."""
    n, d = X.shape
    onehot = np.eye(c)[y]
    total = onehot.sum(axis=0)
    best = None
    for f in range(d):
        order = np.argsort(X[:, f], kind="stable")
        xs = X[order, f]
        cut = np.nonzero(xs[1:] != xs[:-1])[0]  # split between sorted positions i and i + 1
        if not len(cut):
            continue
        left = np.cumsum(onehot[order], axis=0)[cut]
        right = total - left
        nl = (cut + 1.0)[:, None]
        nr = n - nl
        weighted = ((nl - (left ** 2).sum(axis=1, keepdims=True) / nl)
                    + (nr - (right ** 2).sum(axis=1, keepdims=True) / nr))[:, 0] / n
        i = int(weighted.argmin())
        if best is None or weighted[i] < best[2]:
            best = (f, (xs[cut[i]] + xs[cut[i] + 1]) / 2, float(weighted[i]))
    return best


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
