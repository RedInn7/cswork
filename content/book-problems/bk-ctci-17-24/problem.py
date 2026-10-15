LEVEL = '困难'
TAGS = ['动态规划', '前缀和', '矩阵']
SAMPLES = 2


def matrix(s):
    v = list(map(int, s.split()))
    n, m = v[0], v[1]
    return [v[2 + i * m:2 + (i + 1) * m] for i in range(n)]


def kadane(a, allow_empty=False):
    best = 0 if allow_empty else a[0]
    cur = 0
    for x in a:
        cur = max(x, cur + x)
        best = max(best, cur)
    return best


def largest(g, allow_empty=False, rows=True):
    n, m = len(g), len(g[0])
    best = None
    for top in range(n):
        col = [0] * m
        for bottom in range(top, n if rows else top + 1):
            for j in range(m):
                col[j] += g[bottom][j]
            k = kadane(col, allow_empty)
            best = k if best is None else max(best, k)
    return str(best)


def solve(s):
    return largest(matrix(s))


def wrong_empty_allowed(s):
    # Starts Kadane's best at 0, so an all-negative matrix answers 0.
    return largest(matrix(s), allow_empty=True)


def wrong_single_rows(s):
    # Tries one row at a time and never stacks rows.
    return largest(matrix(s), rows=False)


def fmt(g):
    return f'{len(g)} {len(g[0])}\n' + ''.join(' '.join(map(str, row)) + '\n' for row in g)


def cases(r):
    out = [fmt([[-3, 4, 5, -9], [2, 6, 1, -4], [-8, -2, 3, -1]]), fmt([[-5, -1], [-3, -7]]), fmt([[7]]), fmt([[-7]]),
           fmt([[1, -2, 3]]), fmt([[1], [-2], [3]]), fmt([[2, -9, 2], [2, -9, 2]])]
    for n, m, v in [(5, 5, 10), (30, 40, 100), (100, 100, 1000), (60, 100, 1000)]:
        out.append(fmt([[r.randint(-v, v) for _ in range(m)] for _ in range(n)]))
    out.append(fmt([[r.randint(-1000, -1) for _ in range(20)] for _ in range(20)]))
    return out
