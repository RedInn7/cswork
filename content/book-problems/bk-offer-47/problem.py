LEVEL = '中等'
TAGS = ['动态规划', '矩阵']
SAMPLES = 1


def grid(s):
    a = list(map(int, s.split()))
    m, n = a[0], a[1]
    return [a[2 + i * n:2 + (i + 1) * n] for i in range(m)]


def solve(s):
    g = grid(s)
    best = [0] * len(g[0])
    for row in g:
        for j, v in enumerate(row):
            best[j] = v + max(best[j], best[j - 1] if j else 0)
    return str(best[-1])


def wrong_greedy(s):
    g = grid(s)
    m, n = len(g), len(g[0])
    i = j = 0
    total = g[0][0]
    while (i, j) != (m - 1, n - 1):
        if i == m - 1 or (j < n - 1 and g[i][j + 1] >= g[i + 1][j]):
            j += 1
        else:
            i += 1
        total += g[i][j]
    return str(total)


def wrong_edges_not_accumulated(s):
    # Fills the first row and column with the cell values alone.
    g = grid(s)
    m, n = len(g), len(g[0])
    f = [row[:] for row in g]
    for i in range(1, m):
        for j in range(1, n):
            f[i][j] = g[i][j] + max(f[i - 1][j], f[i][j - 1])
    return str(f[-1][-1] if m > 1 and n > 1 else max(map(max, g)))


def fmt(g):
    return f'{len(g)} {len(g[0])}\n' + ''.join(' '.join(map(str, row)) + '\n' for row in g)


def cases(r):
    out = [fmt([[1, 3, 1], [1, 5, 1], [4, 2, 1]]), fmt([[7]]), fmt([[1, 2, 3, 4]]), fmt([[1], [9], [2]]),
           fmt([[0, 0], [0, 0]]), fmt([[1, 2, 5], [3, 2, 1]])]
    for m, n, v in [(3, 4, 9), (10, 10, 100), (50, 80, 1000), (200, 200, 1000), (200, 1, 1000), (1, 200, 1000)]:
        out.append(fmt([[r.randint(0, v) for _ in range(n)] for _ in range(m)]))
    return out
