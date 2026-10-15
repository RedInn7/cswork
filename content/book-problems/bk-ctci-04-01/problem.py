LEVEL = '中等'
TAGS = ['图', '广度优先搜索']
SAMPLES = 2


def parse(s):
    a = list(map(int, s.split()))
    n, m = a[0], a[1]
    edges = [(a[2 + 2 * i], a[3 + 2 * i]) for i in range(m)]
    return n, edges, a[2 + 2 * m], a[3 + 2 * m]


def reach(n, edges, s, t, undirected=False, zero_steps=True):
    adj = [[] for _ in range(n)]
    for u, v in edges:
        adj[u].append(v)
        if undirected:
            adj[v].append(u)
    seen = [False] * n
    stack = [s] if zero_steps else list(adj[s])
    if zero_steps:
        seen[s] = True
    while stack:
        u = stack.pop()
        if u == t:
            return 'true'
        for v in adj[u]:
            if not seen[v]:
                seen[v] = True
                stack.append(v)
    return 'false'


def solve(s):
    return reach(*parse(s))


def wrong_undirected(s):
    return reach(*parse(s), undirected=True)


def wrong_needs_an_edge(s):
    # Starts from s's neighbours, so s reaches itself only through a cycle.
    return reach(*parse(s), zero_steps=False)


def fmt(n, edges, s, t):
    return f'{n} {len(edges)}\n' + ''.join(f'{u} {v}\n' for u, v in edges) + f'{s} {t}\n'


def cases(r):
    out = [fmt(4, [(0, 1), (1, 2), (1, 2), (3, 3), (2, 0)], 0, 2), fmt(2, [(1, 0)], 0, 1), fmt(1, [], 0, 0),
           fmt(3, [(0, 0), (1, 2)], 0, 2), fmt(4, [(0, 1), (1, 2), (2, 3)], 3, 0), fmt(4, [(0, 1)], 2, 2)]
    for n, m, k in [(10, 12, 2), (100, 150, 2), (1000, 1200, 2), (10000, 10000, 1), (5000, 4000, 1)]:
        edges = [(r.randrange(n), r.randrange(n)) for _ in range(m)]
        for _ in range(k):
            out.append(fmt(n, edges, r.randrange(n), r.randrange(n)))
    # A long one-way chain: reachable forwards only.
    n = 6000
    order = list(range(n))
    r.shuffle(order)
    chain = [(order[i], order[i + 1]) for i in range(n - 1)]
    out.append(fmt(n, chain, order[0], order[-1]))
    out.append(fmt(n, chain, order[-1], order[0]))
    return out
