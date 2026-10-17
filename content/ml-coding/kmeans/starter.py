import numpy as np


def kmeans(X: np.ndarray, centers: np.ndarray, max_iter: int):
    """从给定中心开始做 Lloyd 迭代，返回 (最终中心, 每个点的簇)。
    Lloyd's algorithm from the given centers: returns (final centers, each point's cluster)."""
    return centers, np.zeros(len(X), dtype=np.int64)  # TODO


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = sys.stdin.read().split()
    n, d, k, max_iter = (int(v) for v in data[:4])
    values = np.array([float(v) for v in data[4:4 + (n + k) * d]]).reshape(n + k, d)
    X, start = values[:n], values[n:]
    centers, labels = kmeans(X, start.copy(), max_iter)
    centers = np.asarray(centers, dtype=float)
    labels = np.asarray(labels, dtype=np.int64)
    inertia = ((X - centers[labels]) ** 2).sum()
    out = np.concatenate([centers.ravel(), labels.astype(float), [inertia]])
    print(len(out))
    print(" ".join("%.6f" % v for v in out))


main()
