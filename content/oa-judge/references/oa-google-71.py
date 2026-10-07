import heapq
import sys

def solve(raw):
    values = list(map(int, raw.split()))
    if len(values) < 2:
        raise ValueError("expected n and m")
    n, m = values[:2]
    if not (1 <= n <= 200_000 and 0 <= m <= 300_000) or len(values) != 2 + 3*m + 3:
        raise ValueError("input size does not match the supported constraints")
    graph = [[] for _ in range(n)]
    at = 2
    for _ in range(m):
        u, v, w = values[at:at+3]
        at += 3
        if not (0 <= u < n and 0 <= v < n and 0 <= w <= 1_000_000_000):
            raise ValueError("invalid directed edge")
        graph[u].append((v, w))
    start, target, waypoint = values[at:at+3]
    if any(not 0 <= x < n for x in (start, target, waypoint)):
        raise ValueError("node outside graph")

    inf = 10**30
    def dijkstra(source):
        dist = [inf] * n
        dist[source] = 0
        queue = [(0, source)]
        while queue:
            cost, u = heapq.heappop(queue)
            if cost != dist[u]:
                continue
            for v, weight in graph[u]:
                candidate = cost + weight
                if candidate < dist[v]:
                    dist[v] = candidate
                    heapq.heappush(queue, (candidate, v))
        return dist

    from_start = dijkstra(start)
    from_waypoint = dijkstra(waypoint)
    direct = from_start[target]
    via = from_start[waypoint] + from_waypoint[target]
    if from_start[waypoint] == inf or from_waypoint[target] == inf:
        via = -1
    return f"{direct if direct != inf else -1} {via}"

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
