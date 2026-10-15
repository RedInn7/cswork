def counting_sort(keys: list, k: int) -> list:
    """稳定计数排序 / Stable counting sort: record indices ordered by key, ties in input order."""
    return list(range(len(keys)))  # TODO


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = sys.stdin.buffer.read().split()
    n, k = int(data[0]), int(data[1])
    keys = [int(v) for v in data[2:2 + n]]
    print(" ".join(str(i + 1) for i in counting_sort(keys, k)))


main()
