LEVEL = '中等'
TAGS = ['动态规划', '回溯', '矩阵']
SAMPLES = 2


def parse(s):
    lines = s.split('\n')
    r, c = map(int, lines[0].split())
    return r, c, [line[:c] for line in lines[1:r + 1]]


def reachable(r, c, g):
    ok = [[False] * (c + 1) for _ in range(r + 1)]
    for i in range(r - 1, -1, -1):
        for j in range(c - 1, -1, -1):
            if g[i][j] == '0':
                ok[i][j] = (i, j) == (r - 1, c - 1) or ok[i + 1][j] or ok[i][j + 1]
    return ok


def walk(s, first='D', check=True):
    r, c, g = parse(s)
    ok = reachable(r, c, g)
    if not ok[0][0] and check:
        return '-1'
    i = j = 0
    path = []
    free = lambda a, b: a < r and b < c and g[a][b] == '0' and (ok[a][b] or not check)
    while (i, j) != (r - 1, c - 1):
        moves = [('D', i + 1, j), ('R', i, j + 1)]
        if first == 'R':
            moves.reverse()
        for name, a, b in moves:
            if free(a, b):
                path.append(name)
                i, j = a, b
                break
        else:
            return '-1'
    return ''.join(path)


def solve(s):
    return walk(s)


def wrong_greedy_down(s):
    # Goes down whenever the cell below is free, without asking whether the goal is still reachable.
    return walk(s, check=False)


def wrong_right_first(s):
    # Finds a route but tries right before down.
    return walk(s, first='R')


def fmt(g):
    return f'{len(g)} {len(g[0])}\n' + '\n'.join(g) + '\n'


def cases(r):
    out = [fmt(['0010', '0000', '1100']), fmt(['000', '001', '010']), fmt(['0']), fmt(['1']), fmt(['00', '00']),
           fmt(['0100', '0110', '0000']), fmt(['00000']), fmt(['0', '0', '0']), fmt(['000', '000', '001'])]
    for rows, cols, p in [(5, 6, 0.25), (20, 20, 0.3), (100, 100, 0.3), (100, 100, 0.15), (60, 100, 0.35)]:
        while True:
            g = [''.join('1' if r.random() < p else '0' for _ in range(cols)) for _ in range(rows)]
            g[0] = '0' + g[0][1:]
            g[-1] = g[-1][:-1] + '0'
            if walk(fmt(g)) != '-1' or p > 0.33:
                break
        out.append(fmt(g))
    return out
