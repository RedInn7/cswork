class SegmentTree:
    """线段树 / Iterative segment tree of sums: leaves at n..2n-1, node k's parent at k // 2."""

    def __init__(self, values: list):
        n = self.n = len(values)
        self.tree = [0] * n + list(values)
        for k in range(n - 1, 0, -1):
            self.tree[k] = self.tree[2 * k] + self.tree[2 * k + 1]

    def update(self, i: int, x: int) -> None:
        k = i + self.n
        self.tree[k] = x
        while k > 1:
            k //= 2
            self.tree[k] = self.tree[2 * k] + self.tree[2 * k + 1]

    def query(self, l: int, r: int) -> int:
        total, l, r = 0, l + self.n, r + self.n + 1
        while l < r:
            if l & 1:
                total += self.tree[l]
                l += 1
            if r & 1:
                r -= 1
                total += self.tree[r]
            l //= 2
            r //= 2
        return total


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = sys.stdin.buffer.read().split()
    n, q = int(data[0]), int(data[1])
    tree = SegmentTree([int(v) for v in data[2:2 + n]])
    out = []
    for k in range(q):
        op, a, b = data[2 + n + 3 * k], int(data[3 + n + 3 * k]), int(data[4 + n + 3 * k])
        if op == b"set":
            tree.update(a - 1, b)
        else:
            out.append(tree.query(a - 1, b - 1))
    print("\n".join(map(str, out)))


main()
