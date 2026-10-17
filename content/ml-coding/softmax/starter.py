import numpy as np


def softmax(z: np.ndarray) -> np.ndarray:
    """逐行 softmax / Row-wise softmax."""
    return np.zeros_like(z)  # TODO


def log_softmax(z: np.ndarray) -> np.ndarray:
    """逐行 log(softmax)，不能先算 softmax 再取 log / Row-wise log(softmax), not log of softmax."""
    return np.zeros_like(z)  # TODO


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = sys.stdin.read().split()
    n, k = int(data[0]), int(data[1])
    z = np.array([float(v) for v in data[2:2 + n * k]]).reshape(n, k)
    out = np.concatenate([np.asarray(softmax(z), dtype=float).ravel(), np.asarray(log_softmax(z), dtype=float).ravel()])
    print(len(out))
    print(" ".join("%.6f" % v for v in out))


main()
