import sys
from collections import deque

def solve(raw):
    it = iter(map(int, raw.split()))
    n = next(it)
    graph = [[] for _ in range(n + 1)]
    for _ in range(n - 1):
        u, v = next(it), next(it)
        graph[u].append(v)
        graph[v].append(u)

    def farthest(start):
        distance = [-1] * (n + 1)
        distance[start] = 0
        queue = deque([start])
        best_node = start
        while queue:
            u = queue.popleft()
            for v in graph[u]:
                if distance[v] == -1:
                    distance[v] = distance[u] + 1
                    if distance[v] > distance[best_node]:
                        best_node = v
                    queue.append(v)
        return best_node, distance[best_node]

    endpoint, _ = farthest(1)
    _, diameter = farthest(endpoint)
    return f"{diameter}\n"

if __name__ == "__main__":
    print(solve(sys.stdin.read()), end="")
