def merge_sort(a: list) -> int:
    """归并排序 / Sort a in place and return its inversion count."""
    buf = a[:]

    def sort(lo, hi):  # [lo, hi)
        if hi - lo < 2:
            return 0
        mid = (lo + hi) // 2
        count = sort(lo, mid) + sort(mid, hi)
        i, j = lo, mid
        for k in range(lo, hi):
            if j >= hi or (i < mid and a[i] <= a[j]):
                buf[k] = a[i]
                i += 1
            else:
                buf[k] = a[j]
                j += 1
                count += mid - i
        a[lo:hi] = buf[lo:hi]
        return count

    return sort(0, len(a))


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    a = [int(v) for v in data[1:1 + n]]
    print(merge_sort(a))
    print(" ".join(map(str, a)))


main()
