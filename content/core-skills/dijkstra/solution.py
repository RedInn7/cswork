import heapq


def dijkstra(n: int, edges: list, s: int) -> list:
    """Dijkstra / Shortest distances from s to nodes 1..n on non-negative weights; -1 if unreachable."""
    adj = [[] for _ in range(n + 1)]
    for u, v, w in edges:
        adj[u].append((v, w))
    dist = [-1] * (n + 1)
    dist[s] = 0
    heap = [(0, s)]
    while heap:
        d, u = heapq.heappop(heap)
        if d > dist[u]:
            continue  # stale
        for v, w in adj[u]:
            if dist[v] < 0 or d + w < dist[v]:
                dist[v] = d + w
                heapq.heappush(heap, (d + w, v))
    return dist[1:]


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    data = list(map(int, sys.stdin.buffer.read().split()))
    n, m, s = data[0], data[1], data[2]
    edges = [(data[3 + 3 * i], data[4 + 3 * i], data[5 + 3 * i]) for i in range(m)]
    print(" ".join(map(str, dijkstra(n, edges, s))))


main()
