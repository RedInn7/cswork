def kruskal(n: int, edges: list) -> list:
    """Kruskal / Indices of the chosen edges in the order chosen; fewer than n - 1 if disconnected."""
    parent, rank = list(range(n + 1)), [0] * (n + 1)

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]  # path halving
            x = parent[x]
        return x

    chosen = []
    for i in sorted(range(len(edges)), key=lambda i: (edges[i][2], i)):
        a, b = find(edges[i][0]), find(edges[i][1])
        if a == b:
            continue
        if rank[a] < rank[b]:
            a, b = b, a
        parent[b] = a
        rank[a] += rank[a] == rank[b]
        chosen.append(i)
        if len(chosen) == n - 1:
            break
    return chosen


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = list(map(int, sys.stdin.buffer.read().split()))
    n, m = data[0], data[1]
    edges = [(data[2 + 3 * i], data[3 + 3 * i], data[4 + 3 * i]) for i in range(m)]
    chosen = kruskal(n, edges)
    if len(chosen) != n - 1:
        print(-1)
    else:
        print(sum(edges[i][2] for i in chosen))
        print(" ".join(str(i + 1) for i in chosen))


main()
