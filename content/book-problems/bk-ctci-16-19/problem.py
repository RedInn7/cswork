LEVEL = '中等'
TAGS = ['深度优先搜索', '广度优先搜索', '矩阵']
SAMPLES = 1
MAX_N = (300, 300)
EIGHT = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
FOUR = [(-1, 0), (0, -1), (0, 1), (1, 0)]


def ponds(s, steps=EIGHT):
    v = s.split()
    r, c = int(v[0]), int(v[1])
    water = [[v[2 + i * c + j] == '0' for j in range(c)] for i in range(r)]
    sizes = []
    for i in range(r):
        for j in range(c):
            if water[i][j]:
                water[i][j] = False
                stack, size = [(i, j)], 0
                while stack:
                    a, b = stack.pop()
                    size += 1
                    for da, db in steps:
                        x, y = a + da, b + db
                        if 0 <= x < r and 0 <= y < c and water[x][y]:
                            water[x][y] = False
                            stack.append((x, y))
                sizes.append(size)
    return sizes


def show(sizes):
    return f'{len(sizes)}\n' + ' '.join(map(str, sizes))


def solve(s):
    return show(sorted(ponds(s)))


def wrong_four_directions(s):
    return show(sorted(ponds(s, FOUR)))


def wrong_largest_first(s):
    return show(sorted(ponds(s), reverse=True))


def fmt(g):
    return f'{len(g)} {len(g[0])}\n' + ''.join(' '.join(map(str, row)) + '\n' for row in g)


def cases(r):
    out = [fmt([[3, 0, 0, 5], [0, 4, 2, 0], [1, 0, 7, 8], [6, 6, 6, 0]]), fmt([[0]]), fmt([[5]]), fmt([[0, 0], [0, 0]]),
           fmt([[0, 1, 0], [1, 0, 1], [0, 1, 0]]), fmt([[1, 0, 1, 1, 0]])]
    for rows, cols, p in [(5, 5, 0.4), (30, 40, 0.45), (200, 200, 0.35), (300, 300, 0.6)]:
        out.append(fmt([[0 if r.random() < p else r.randint(1, 9) for _ in range(cols)] for _ in range(rows)]))
    return out
