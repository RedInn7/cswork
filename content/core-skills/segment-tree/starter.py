class SegmentTree:
    """线段树 / Segment tree of range sums with point updates."""

    def __init__(self, values: list):
        pass  # TODO

    def update(self, i: int, x: int) -> None:
        pass  # TODO

    def query(self, l: int, r: int) -> int:
        return 0  # TODO


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
