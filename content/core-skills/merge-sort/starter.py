def merge_sort(a: list) -> int:
    """归并排序 / Sort a in place and return its inversion count."""
    return 0  # TODO


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    a = [int(v) for v in data[1:1 + n]]
    print(merge_sort(a))
    print(" ".join(map(str, a)))


main()
