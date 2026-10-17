import numpy as np


def ridge_fit(X: np.ndarray, y: np.ndarray, lam: float):
    """最小化 Σ(y - Xw - b)² + lam·||w||²，截距 b 不加惩罚；返回 (w, b)。
    Minimize Σ(y - Xw - b)² + lam·||w||² with an unpenalized intercept b; return (w, b)."""
    x_mean, y_mean = X.mean(axis=0), y.mean()
    Xc, yc = X - x_mean, y - y_mean
    w = np.linalg.solve(Xc.T @ Xc + lam * np.eye(X.shape[1]), Xc.T @ yc)
    return w, y_mean - x_mean @ w


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = sys.stdin.read().split()
    n, d, lam = int(data[0]), int(data[1]), float(data[2])
    rows = np.array([float(v) for v in data[3:3 + n * (d + 1)]]).reshape(n, d + 1)
    X, y = rows[:, :d], rows[:, d]
    w, b = ridge_fit(X, y, lam)
    w = np.asarray(w, dtype=float).ravel()
    mse = ((X @ w + float(b) - y) ** 2).mean()
    out = np.concatenate([w, [float(b), mse]])
    print(len(out))
    print(" ".join("%.6f" % v for v in out))


main()
