import numpy as np


def lcg_indices(seed: int, n: int, count: int) -> np.ndarray:
    """题目给定的 LCG 依次产生 count 个 [0, n) 里的下标 / `count` indices in [0, n) from the given LCG, in order."""
    out = np.empty(count, dtype=np.int64)
    state = seed
    for k in range(count):
        state = (1664525 * state + 1013904223) % 4294967296
        out[k] = state * n >> 32
    return out


def bootstrap_ci(x: np.ndarray, B: int, level: float, seed: int):
    """返回 (样本均值, 自助法标准误, 置信区间下界, 上界) / Return (sample mean, bootstrap standard error, lower, upper)."""
    n = len(x)
    means = x[lcg_indices(seed, n, B * n).reshape(B, n)].mean(axis=1)
    tail = (1 - level) / 2
    low, high = np.percentile(means, [100 * tail, 100 * (1 - tail)])
    return x.mean(), means.std(ddof=1), low, high


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = sys.stdin.read().split()
    n, B, level, seed = int(data[0]), int(data[1]), float(data[2]), int(data[3])
    x = np.array([float(v) for v in data[4:4 + n]])
    out = [float(v) for v in bootstrap_ci(x, B, level, seed)]
    print(len(out))
    print(" ".join("%.6f" % v for v in out))


main()
