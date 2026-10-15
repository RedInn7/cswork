import heapq


def dijkstra(n: int, edges: list, s: int) -> list:
    """Dijkstra / Shortest distances from s to nodes 1..n on non-negative weights; -1 if unreachable."""
    return [-1] * n  # TODO


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = list(map(int, sys.stdin.buffer.read().split()))
    n, m, s = data[0], data[1], data[2]
    edges = [(data[3 + 3 * i], data[4 + 3 * i], data[5 + 3 * i]) for i in range(m)]
    print(" ".join(map(str, dijkstra(n, edges, s))))


main()
