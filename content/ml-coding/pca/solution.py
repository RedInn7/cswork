import numpy as np


def pca(X: np.ndarray, m: int):
    """前 m 个主成分（m×d，每行单位向量，绝对值最大的分量为正）和它们的方差解释比例。
    The top m principal components (m×d, unit rows, largest-magnitude entry positive) and their explained variance ratios."""
    Xc = X - X.mean(axis=0)
    values, vectors = np.linalg.eigh(Xc.T @ Xc / (len(X) - 1))
    order = np.argsort(values)[::-1][:m]
    components = vectors[:, order].T
    peaks = components[np.arange(m), np.abs(components).argmax(axis=1)]
    return components * np.sign(peaks)[:, None], values[order] / values.sum()


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = sys.stdin.read().split()
    n, d, m = int(data[0]), int(data[1]), int(data[2])
    X = np.array([float(v) for v in data[3:3 + n * d]]).reshape(n, d)
    components, ratios = pca(X, m)
    components = np.asarray(components, dtype=float).reshape(m, d)
    projected = (X - X.mean(axis=0)) @ components.T
    out = np.concatenate([components.ravel(), np.asarray(ratios, dtype=float).ravel(), projected.ravel()])
    print(len(out))
    print(" ".join("%.6f" % v for v in out))


main()
