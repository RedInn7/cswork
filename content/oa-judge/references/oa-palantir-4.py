import heapq
import sys

def minimize_path_value(n, edges, source, destination):
    if source == destination:
        return 0
    graph = [[] for _ in range(n + 1)]
    for u, v, weight in edges:
        graph[u].append((v, weight))
        graph[v].append((u, weight))
    infinity = 10**30
    best = [infinity] * (n + 1)
    best[source] = 0
    heap = [(0, source)]
    while heap:
        stress, u = heapq.heappop(heap)
        if stress != best[u]:
            continue
        if u == destination:
            return stress
        for v, weight in graph[u]:
            candidate = max(stress, weight)
            if candidate < best[v]:
                best[v] = candidate
                heapq.heappush(heap, (candidate, v))
    return -1

def solve(raw):
    tokens = list(map(int, raw.split()))
    if len(tokens) < 4:
        raise ValueError("incomplete graph input")
    n, m = tokens[0], tokens[1]
    if len(tokens) != 2 + 3 * m + 2:
        raise ValueError("edge count does not match input")
    edges = []
    pos = 2
    for _ in range(m):
        edges.append((tokens[pos], tokens[pos + 1], tokens[pos + 2]))
        pos += 3
    return str(minimize_path_value(n, edges, tokens[pos], tokens[pos + 1]))

if __name__ == "__main__":
    print(solve(sys.stdin.buffer.read()))
