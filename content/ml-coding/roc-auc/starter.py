import numpy as np


def roc_auc(y: np.ndarray, scores: np.ndarray) -> float:
    """ROC 曲线下面积；分数相同的样本取平均秩 / Area under the ROC curve; tied scores share an average rank."""
    return 0.0  # TODO


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
