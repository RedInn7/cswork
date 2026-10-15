import random


def partition(a: list, lo: int, hi: int) -> int:
    """Lomuto 划分 / Lomuto partition around a[hi]; returns the pivot's final index."""
    pivot = a[hi]
    i = lo
    for j in range(lo, hi):
        if a[j] < pivot:
            a[i], a[j] = a[j], a[i]
            i += 1
    a[i], a[hi] = a[hi], a[i]
    return i


def quick_sort(a: list) -> None:
    """原地升序排序 / Sort a in place: random pivots, recursion into the shorter side."""

    def sort(lo, hi):
        while lo < hi:
            r = random.randint(lo, hi)
            a[r], a[hi] = a[hi], a[r]
            p = partition(a, lo, hi)
            if p - lo < hi - p:
                sort(lo, p - 1)
                lo = p + 1
            else:
                sort(p + 1, hi)
                hi = p - 1

    sort(0, len(a) - 1)


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    a = [int(v) for v in data[1:1 + n]]
    b = a[:]
    p = partition(b, 0, n - 1)
    quick_sort(a)
    print(p)
    print(" ".join(map(str, b)))
    print(" ".join(map(str, a)))


main()
