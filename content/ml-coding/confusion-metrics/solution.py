import numpy as np


def confusion_matrix(y_true: np.ndarray, y_pred: np.ndarray, k: int) -> np.ndarray:
    """k×k 矩阵：cm[i][j] 是真实为 i、预测为 j 的样本数 / cm[i][j] counts samples of true class i predicted as j."""
    cm = np.zeros((k, k), dtype=np.int64)
    np.add.at(cm, (y_true, y_pred), 1)
    return cm


def precision_recall_f1(cm: np.ndarray):
    """逐类 precision、recall、F1（分母为 0 记 0），再加 macro-F1 和 accuracy。
    Per-class precision, recall and F1 (0 when a denominator is 0), then macro-F1 and accuracy."""
    cm = np.asarray(cm, dtype=float)
    tp = np.diag(cm)
    predicted = cm.sum(axis=0)
    actual = cm.sum(axis=1)
    zeros = np.zeros_like(tp)
    precision = np.divide(tp, predicted, out=zeros.copy(), where=predicted > 0)
    recall = np.divide(tp, actual, out=zeros.copy(), where=actual > 0)
    total = precision + recall
    f1 = np.divide(2 * precision * recall, total, out=zeros.copy(), where=total > 0)
    return precision, recall, f1, f1.mean(), tp.sum() / cm.sum()


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = sys.stdin.read().split()
    n, k = int(data[0]), int(data[1])
    y_true = np.array([int(v) for v in data[2:2 + n]], dtype=np.int64)
    y_pred = np.array([int(v) for v in data[2 + n:2 + 2 * n]], dtype=np.int64)
    cm = confusion_matrix(y_true, y_pred, k)
    precision, recall, f1, macro_f1, accuracy = precision_recall_f1(cm)
    parts = [cm, precision, recall, f1, [macro_f1, accuracy]]
    out = np.concatenate([np.asarray(part, dtype=float).ravel() for part in parts])
    print(len(out))
    print(" ".join("%.6f" % v for v in out))


main()
