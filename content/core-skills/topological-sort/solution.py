import heapq


def topo_order(n: int, edges: list) -> list:
    """Kahn 算法 / Kahn's algorithm with a min-heap: the smallest order, or [] on a cycle."""
    out_edges = [[] for _ in range(n + 1)]
    indegree = [0] * (n + 1)
    for u, v in edges:
        out_edges[u].append(v)
        indegree[v] += 1
    ready = [v for v in range(1, n + 1) if indegree[v] == 0]
    heapq.heapify(ready)
    order = []
    while ready:
        u = heapq.heappop(ready)
        order.append(u)
        for v in out_edges[u]:
            indegree[v] -= 1
            if indegree[v] == 0:
                heapq.heappush(ready, v)
    return order if len(order) == n else []


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = list(map(int, sys.stdin.buffer.read().split()))
    n, m = data[0], data[1]
    edges = [(data[2 + 2 * i], data[3 + 2 * i]) for i in range(m)]
    order = topo_order(n, edges)
    print(" ".join(map(str, order)) if order else -1)


main()
