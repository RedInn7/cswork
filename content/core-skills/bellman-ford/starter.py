INF = 10**18  # 到不了 / unreachable


def bellman_ford(n: int, edges: list, s: int):
    """Bellman-Ford / Distances from s to nodes 1..n (INF if unreachable), or None if s reaches a negative cycle."""
    return [INF] * n  # TODO


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = list(map(int, sys.stdin.buffer.read().split()))
    n, m, s = data[0], data[1], data[2]
    edges = [(data[3 + 3 * i], data[4 + 3 * i], data[5 + 3 * i]) for i in range(m)]
    dist = bellman_ford(n, edges, s)
    if dist is None:
        print("NEGATIVE CYCLE")
    else:
        print(" ".join("INF" if d == INF else str(d) for d in dist))


main()
