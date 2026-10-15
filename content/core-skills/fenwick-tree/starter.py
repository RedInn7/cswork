class FenwickTree:
    """树状数组 / Fenwick tree over indices 1..n: tree[i] sums (i - lowbit(i), i]."""

    def __init__(self, values: list):
        self.n = len(values)
        self.tree = [0] * (self.n + 1)
        # TODO: 建树 / build

    def add(self, i: int, x: int) -> None:
        pass  # TODO

    def prefix(self, i: int) -> int:
        return 0  # TODO

    def kth(self, k: int) -> int:
        return -1  # TODO: 倍增 / binary lifting


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = sys.stdin.buffer.read().split()
    n, q = int(data[0]), int(data[1])
    tree = FenwickTree([int(v) for v in data[2:2 + n]])
    out, k = [], 2 + n
    for _ in range(q):
        op = data[k]
        if op == b"add":
            tree.add(int(data[k + 1]), int(data[k + 2]))
            k += 3
        elif op == b"prefix":
            out.append(tree.prefix(int(data[k + 1])))
            k += 2
        else:
            out.append(tree.kth(int(data[k + 1])))
            k += 2
    print("\n".join(map(str, out)))


main()
