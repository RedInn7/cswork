import numpy as np


def assign(X: np.ndarray, centers: np.ndarray) -> np.ndarray:
    """每个点最近的中心；距离相同取下标小的 / Each point's nearest center; on a tie the lower index."""
    d2 = ((X[:, None, :] - centers[None, :, :]) ** 2).sum(axis=2)
    return d2.argmin(axis=1)


def kmeans(X: np.ndarray, centers: np.ndarray, max_iter: int):
    """从给定中心开始做 Lloyd 迭代，返回 (最终中心, 每个点的簇)。
    Lloyd's algorithm from the given centers: returns (final centers, each point's cluster)."""
    centers = np.array(centers, dtype=float)
    labels = assign(X, centers)
    for _ in range(max_iter):
        for j in range(len(centers)):
            members = X[labels == j]
            if len(members):  # an empty cluster keeps its center
                centers[j] = members.mean(axis=0)
        moved = assign(X, centers)
        if np.array_equal(moved, labels):
            break
        labels = moved
    return centers, labels


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
