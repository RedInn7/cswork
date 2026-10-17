import numpy as np


def roc_auc(y: np.ndarray, scores: np.ndarray) -> float:
    """ROC 曲线下面积；分数相同的样本取平均秩 / Area under the ROC curve; tied scores share an average rank."""
    _, inverse, counts = np.unique(scores, return_inverse=True, return_counts=True)
    # 1-based ranks: a run of equal scores ending at rank e with c members averages e - (c - 1) / 2.
    ends = np.cumsum(counts)
    ranks = (ends - (counts - 1) / 2.0)[inverse.ravel()]
    positive = y == 1
    p = int(positive.sum())
    q = len(y) - p
    return (ranks[positive].sum() - p * (p + 1) / 2.0) / (p * q)


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = sys.stdin.read().split()
    t, at = int(data[0]), 1
    out = []
    for _ in range(t):
        n = int(data[at])
        y = np.array([int(v) for v in data[at + 1:at + 1 + n]], dtype=np.int64)
        scores = np.array([float(v) for v in data[at + 1 + n:at + 1 + 2 * n]])
        at += 1 + 2 * n
        out.append(float(roc_auc(y, scores)))
    print(len(out))
    print(" ".join("%.6f" % v for v in out))


main()
