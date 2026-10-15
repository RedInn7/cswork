class UnionFind:
    """并查集 / Union-find over nodes 1..n with path halving and union by rank."""

    def __init__(self, n: int):
        self.parent = list(range(n + 1))
        # TODO: 秩、集合大小、集合个数 / ranks, set sizes, number of sets

    def find(self, x: int) -> int:
        return x  # TODO

    def union(self, a: int, b: int) -> bool:
        return False  # TODO

    def same(self, a: int, b: int) -> bool:
        return False  # TODO

    def size(self, x: int) -> int:
        return 1  # TODO

    def count(self) -> int:
        return 0  # TODO


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    it = iter(sys.stdin.buffer.read().split())
    uf = UnionFind(int(next(it)))
    out = []
    for _ in range(int(next(it))):
        op = next(it)
        if op == b"union":
            a = int(next(it))
            out.append(1 if uf.union(a, int(next(it))) else 0)
        elif op == b"same":
            a = int(next(it))
            out.append(1 if uf.same(a, int(next(it))) else 0)
        elif op == b"size":
            out.append(uf.size(int(next(it))))
        else:
            out.append(uf.count())
    print("\n".join(map(str, out)))


main()
