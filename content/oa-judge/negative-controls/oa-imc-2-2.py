# 把 k 大于 1 的序号左移
def solve(raw):
    t = list(map(int, raw.split())); n = t[0]; parent = t[1:n+1]; q = t[n+1]; at = n+2
    children = [[] for _ in range(n)]
    for v in range(1, n): children[parent[v]].append(v)
    tour, tin, size = [], [0]*n, [0]*n
    stack = [(0, 0)]
    while stack:
        u, phase = stack.pop()
        if phase == 0:
            tin[u] = len(tour); tour.append(u); stack.append((u, 1))
            for v in reversed(children[u]): stack.append((v, 0))
        else:
            size[u] = len(tour) - tin[u]
    ans=[]
    for _ in range(q):
        p,k=t[at:at+2];at+=2;ans.append(str(tour[tin[p]+max(0,k-2)] if 1 <= k <= size[p] else -1))
    return " ".join(ans)
