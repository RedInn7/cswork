import sys
from collections import deque

def solve(raw):
    it = iter(map(int, raw.split()))
    n = next(it)
    g = [[] for _ in range(n + 1)]
    for _ in range(n - 1):
        a, b = next(it), next(it)
        g[a].append(b)
    best = 0; q = deque([(1, 0)]); seen = {1}
    while q:
        u, d = q.popleft(); best = max(best, d)
        for v in g[u]:
            if v not in seen:
                seen.add(v); q.append((v, d + 1))
    return f"{best}\n"

if __name__ == "__main__":
    print(solve(sys.stdin.read()), end="")
