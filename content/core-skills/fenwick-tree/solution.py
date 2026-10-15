class FenwickTree:
    """树状数组 / Fenwick tree over indices 1..n: tree[i] sums (i - lowbit(i), i]."""

    def __init__(self, values: list):
        n = self.n = len(values)
        self.tree = [0] + list(values)
        for i in range(1, n + 1):  # O(n) build
            j = i + (i & -i)
            if j <= n:
                self.tree[j] += self.tree[i]

    def add(self, i: int, x: int) -> None:
        while i <= self.n:
            self.tree[i] += x
            i += i & -i

    def prefix(self, i: int) -> int:
        total = 0
        while i > 0:
            total += self.tree[i]
            i -= i & -i
        return total

    def kth(self, k: int) -> int:
        if self.prefix(self.n) < k:
            return -1
        pos, step = 0, 1 << self.n.bit_length()
        while step:
            if pos + step <= self.n and self.tree[pos + step] < k:
                pos += step
                k -= self.tree[pos]
            step >>= 1
        return pos + 1


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
