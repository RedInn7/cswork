class UnionFind:
    """并查集 / Union-find over nodes 1..n with path halving and union by rank."""

    def __init__(self, n: int):
        self.parent = list(range(n + 1))
        self.rank = [0] * (n + 1)
        self.sizes = [1] * (n + 1)
        self.sets = n

    def find(self, x: int) -> int:
        parent = self.parent
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(self, a: int, b: int) -> bool:
        a, b = self.find(a), self.find(b)
        if a == b:
            return False
        if self.rank[a] < self.rank[b]:
            a, b = b, a
        self.parent[b] = a
        self.sizes[a] += self.sizes[b]
        if self.rank[a] == self.rank[b]:
            self.rank[a] += 1
        self.sets -= 1
        return True

    def same(self, a: int, b: int) -> bool:
        return self.find(a) == self.find(b)

    def size(self, x: int) -> int:
        return self.sizes[self.find(x)]

    def count(self) -> int:
        return self.sets


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
