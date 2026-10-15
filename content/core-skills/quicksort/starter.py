import random


def partition(a: list, lo: int, hi: int) -> int:
    """Lomuto 划分 / Lomuto partition around a[hi]; returns the pivot's final index."""
    return lo  # TODO


def quick_sort(a: list) -> None:
    """原地升序排序 / Sort a in place."""
    pass  # TODO


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
