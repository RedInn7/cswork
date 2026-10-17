import numpy as np


def ewma(x: np.ndarray, alpha: float):
    """返回 (s, v_hat)：s 是从 s_1 = x_1 开始的递推 EWMA，v_hat 是从 v_0 = 0 开始、再做偏差修正的 EWMA。
    Return (s, v_hat): s is the recursive EWMA from s_1 = x_1, v_hat the bias-corrected one from v_0 = 0."""
    s = np.empty(len(x))
    v_hat = np.empty(len(x))
    level, v = x[0], 0.0
    for t, value in enumerate(x, start=1):
        if t > 1:
            level = alpha * value + (1 - alpha) * level
        v = (1 - alpha) * v + alpha * value
        s[t - 1] = level
        v_hat[t - 1] = v / (1 - (1 - alpha) ** t)
    return s, v_hat


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = sys.stdin.read().split()
    n, alpha = int(data[0]), float(data[1])
    x = np.array([float(v) for v in data[2:2 + n]])
    s, v_hat = ewma(x, alpha)
    out = np.concatenate([np.asarray(s, dtype=float).ravel(), np.asarray(v_hat, dtype=float).ravel()])
    print(len(out))
    print(" ".join("%.6f" % v for v in out))


main()
