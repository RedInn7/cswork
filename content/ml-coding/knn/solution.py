import numpy as np


def knn_predict(X_train: np.ndarray, y_train: np.ndarray, X_query: np.ndarray, k: int) -> np.ndarray:
    """每个查询点的预测类别 / The predicted class of every query point.
    距离相同时下标小的训练点优先；票数相同时取编号小的类别。
    Equal distances: the lower training index first. Equal votes: the smaller class."""
    d2 = ((X_query[:, None, :] - X_train[None, :, :]) ** 2).sum(axis=2)
    nearest = np.argsort(d2, axis=1, kind="stable")[:, :k]
    return np.array([np.bincount(y_train[row]).argmax() for row in nearest])


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = sys.stdin.read().split()
    n, m, d, k = (int(v) for v in data[:4])
    train = np.array([int(v) for v in data[4:4 + n * (d + 1)]], dtype=np.int64).reshape(n, d + 1)
    query = np.array([int(v) for v in data[4 + n * (d + 1):4 + n * (d + 1) + m * d]], dtype=np.int64).reshape(m, d)
    out = np.asarray(knn_predict(train[:, :d], train[:, d], query, k), dtype=float).ravel()
    print(len(out))
    print(" ".join("%.6f" % v for v in out))


main()
