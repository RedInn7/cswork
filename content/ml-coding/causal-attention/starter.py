import numpy as np


def attention(Q: np.ndarray, K: np.ndarray, V: np.ndarray, causal: bool):
    """缩放点积注意力，返回 (输出, 注意力权重)；causal 时位置 i 只能看 j <= i。
    Scaled dot-product attention, returning (output, attention weights); when causal, position i sees only j <= i."""
    t = len(Q)
    return np.zeros((t, V.shape[1])), np.zeros((t, t))  # TODO


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = sys.stdin.read().split()
    t, dk, dv, causal = (int(v) for v in data[:4])
    values = np.array([float(v) for v in data[4:4 + t * (2 * dk + dv)]])
    Q = values[:t * dk].reshape(t, dk)
    K = values[t * dk:2 * t * dk].reshape(t, dk)
    V = values[2 * t * dk:].reshape(t, dv)
    output, weights = attention(Q, K, V, causal == 1)
    out = np.concatenate([np.asarray(weights, dtype=float).ravel(), np.asarray(output, dtype=float).ravel()])
    print(len(out))
    print(" ".join("%.6f" % v for v in out))


main()
