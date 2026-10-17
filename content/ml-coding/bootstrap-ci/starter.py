import numpy as np


def bootstrap_ci(x: np.ndarray, B: int, level: float, seed: int):
    """返回 (样本均值, 自助法标准误, 置信区间下界, 上界) / Return (sample mean, bootstrap standard error, lower, upper)."""
    return 0.0, 0.0, 0.0, 0.0  # TODO


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
