import numpy as np


def sigmoid(z: np.ndarray) -> np.ndarray:
    return 0.5 * (1 + np.tanh(z / 2))  # = 1 / (1 + e^-z), without overflow for very negative z


def train_logistic(X: np.ndarray, y: np.ndarray, lr: float, lam: float, epochs: int):
    """w、b 从 0 开始，做 epochs 轮全批量梯度下降，损失是平均交叉熵加 (lam/2)·||w||²；返回 (w, b)。
    From w = 0, b = 0, run `epochs` full-batch gradient steps on the mean cross-entropy plus (lam/2)·||w||²; return (w, b)."""
    return np.zeros(X.shape[1]), 0.0  # TODO


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = sys.stdin.read().split()
    n, d, m = int(data[0]), int(data[1]), int(data[2])
    lr, lam, epochs = float(data[3]), float(data[4]), int(data[5])
    values = np.array([float(v) for v in data[6:6 + n * (d + 1) + m * d]])
    train = values[:n * (d + 1)].reshape(n, d + 1)
    query = values[n * (d + 1):].reshape(m, d)
    w, b = train_logistic(train[:, :d], train[:, d], lr, lam, epochs)
    w = np.asarray(w, dtype=float).ravel()
    z = query @ w + float(b)
    out = np.concatenate([w, [float(b)], 0.5 * (1 + np.tanh(z / 2))])
    print(len(out))
    print(" ".join("%.6f" % v for v in out))


main()
