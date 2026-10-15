import heapq


def topo_order(n: int, edges: list) -> list:
    """Kahn 算法 / Kahn's algorithm with a min-heap: the smallest order, or [] on a cycle."""
    return []  # TODO


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = list(map(int, sys.stdin.buffer.read().split()))
    n, m = data[0], data[1]
    edges = [(data[2 + 2 * i], data[3 + 2 * i]) for i in range(m)]
    order = topo_order(n, edges)
    print(" ".join(map(str, order)) if order else -1)


main()
