import numpy as np


def conv2d(image: np.ndarray, kernel: np.ndarray, bias: float, stride: int, padding: int) -> np.ndarray:
    """单通道二维卷积（互相关，卷积核不翻转），四周补 padding 圈 0，步长 stride，结果加 bias。
    Single-channel 2D convolution (cross-correlation: the kernel is not flipped), zero padding, stride, plus bias."""
    return np.zeros(image.shape)  # TODO


def max_pool(x: np.ndarray) -> np.ndarray:
    """2×2 最大池化，步长 2，奇数的最后一行 / 一列丢弃 / 2×2 max pooling with stride 2; an odd last row or column is dropped."""
    return x  # TODO


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = sys.stdin.read().split()
    h, w, kh, kw, stride, padding = (int(v) for v in data[:6])
    bias = float(data[6])
    values = np.array([float(v) for v in data[7:7 + h * w + kh * kw]])
    image, kernel = values[:h * w].reshape(h, w), values[h * w:].reshape(kh, kw)
    conv = np.asarray(conv2d(image, kernel, bias, stride, padding), dtype=float)
    pooled = np.asarray(max_pool(np.maximum(conv, 0)), dtype=float)
    out = np.concatenate([conv.shape, pooled.shape, conv.ravel(), pooled.ravel()])
    print(len(out))
    print(" ".join("%.6f" % v for v in out))


main()
