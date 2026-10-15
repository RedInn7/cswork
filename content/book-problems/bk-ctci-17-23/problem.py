LEVEL = '中等'
TAGS = ['动态规划', '矩阵']
SAMPLES = 2
MAX_N = 150


def grid(s):
    lines = s.split()
    n = int(lines[0])
    return lines[1:1 + n]


def runs(g):
    n = len(g)
    right = [[0] * (n + 1) for _ in range(n + 1)]
    down = [[0] * (n + 1) for _ in range(n + 1)]
    for i in range(n - 1, -1, -1):
        for j in range(n - 1, -1, -1):
            if g[i][j] == '0':
                right[i][j] = right[i][j + 1] + 1
                down[i][j] = down[i + 1][j] + 1
    return right, down


def best(s, filled=False, last=False):
    g = grid(s)
    n = len(g)
    right, down = runs(g)
    top = None
    for i in range(n):
        for j in range(n):
            for size in range(min(right[i][j], down[i][j]), 0, -1):
                if top and size < top[2]:
                    break
                ok = down[i][j + size - 1] >= size and right[i + size - 1][j] >= size
                if ok and filled:
                    ok = all(right[i + k][j] >= size for k in range(size))
                if ok:
                    if not top or size > top[2] or (last and size == top[2]):
                        top = (i, j, size)
                    break
    return '%d %d %d' % top if top else '-1'


def solve(s):
    return best(s)


def wrong_whole_square_black(s):
    return best(s, filled=True)


def wrong_last_on_tie(s):
    return best(s, last=True)


def fmt(g):
    return f'{len(g)}\n' + '\n'.join(g) + '\n'


def cases(r):
    out = [fmt(['1000', '1010', '1000', '1111']), fmt(['11', '11']), fmt(['0']), fmt(['1']), fmt(['00', '00']),
           fmt(['010', '101', '010']), fmt(['000', '010', '000'])]
    for n, p in [(5, 0.7), (20, 0.85), (80, 0.9), (150, 0.93), (150, 0.97)]:
        out.append(fmt([''.join('0' if r.random() < p else '1' for _ in range(n)) for _ in range(n)]))
    return out
