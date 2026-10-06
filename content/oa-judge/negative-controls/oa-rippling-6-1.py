import sys
from collections import deque

def solve(raw):
    it = iter(map(int, raw.split()))
    n = next(it)
    g = [[] for _ in range(n + 1)]
    for _ in range(n - 1):
        a, b = next(it), next(it)
        g[a].append(b); g[b].append(a)
    d = [-1] * (n + 1); d[1] = 0; q = deque([1])
    while q:
        u = q.popleft()
        for v in g[u]:
            if d[v] < 0:
                d[v] = d[u] + 1; q.append(v)
    return f"{max(d)}\n"

if __name__ == "__main__":
    print(solve(sys.stdin.read()), end="")
