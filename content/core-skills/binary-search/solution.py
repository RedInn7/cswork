def lower_bound(a: list, x: int) -> int:
    """第一个 >= x 的下标 / First index with a[i] >= x, or len(a)."""
    lo, hi = 0, len(a)
    while lo < hi:
        mid = (lo + hi) // 2
        if a[mid] < x:
            lo = mid + 1
        else:
            hi = mid
    return lo


def upper_bound(a: list, x: int) -> int:
    """第一个 > x 的下标 / First index with a[i] > x, or len(a)."""
    lo, hi = 0, len(a)
    while lo < hi:
        mid = (lo + hi) // 2
        if a[mid] <= x:
            lo = mid + 1
        else:
            hi = mid
    return lo


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = sys.stdin.buffer.read().split()
    n, q = int(data[0]), int(data[1])
    a = [int(v) for v in data[2:2 + n]]
    out = []
    for token in data[2 + n:2 + n + q]:
        x = int(token)
        out.append(f"{lower_bound(a, x)} {upper_bound(a, x)}")
    print("\n".join(out))


main()
