LEVEL = '中等'
TAGS = ['数组', '矩阵', '模拟']
SAMPLES = 1


def boards(s):
    lines = s.split('\n')
    out, k = [], 1
    for _ in range(int(lines[0])):
        n = int(lines[k])
        out.append(lines[k + 1:k + 1 + n])
        k += n + 1
    return out


def verdict(b, anti=True, pending=True):
    n = len(b)
    lines = [row for row in b] + [''.join(b[i][j] for i in range(n)) for j in range(n)]
    lines.append(''.join(b[i][i] for i in range(n)))
    if anti:
        lines.append(''.join(b[i][n - 1 - i] for i in range(n)))
    for line in lines:
        if line[0] != '.' and line == line[0] * n:
            return line[0]
    return 'Pending' if pending and any('.' in row for row in b) else 'Draw'


def solve(s):
    return '\n'.join(verdict(b) for b in boards(s))


def wrong_main_diagonal_only(s):
    return '\n'.join(verdict(b, anti=False) for b in boards(s))


def wrong_never_pending(s):
    return '\n'.join(verdict(b, pending=False) for b in boards(s))


def fmt(bs):
    return f'{len(bs)}\n' + ''.join(f'{len(b)}\n' + '\n'.join(b) + '\n' for b in bs)


def random_board(r, n, fill):
    while True:
        b = [''.join(r.choice('XO') if r.random() < fill else '.' for _ in range(n)) for _ in range(n)]
        lines = [row for row in b] + [''.join(b[i][j] for i in range(n)) for j in range(n)]
        lines += [''.join(b[i][i] for i in range(n)), ''.join(b[i][n - 1 - i] for i in range(n))]
        winners = {line[0] for line in lines if line[0] != '.' and line == line[0] * n}
        if len(winners) < 2:
            return b


def plant(r, n, mark, kind):
    b = [list(row) for row in random_board(r, n, 0.6)]
    for k in range(n):
        i, j = {'row': (0, k), 'col': (k, 0), 'diag': (k, k), 'anti': (k, n - 1 - k)}[kind]
        b[i][j] = mark
    other = 'O' if mark == 'X' else 'X'
    for row in b:
        for j, c in enumerate(row):
            if c == other:
                row[j] = '.'
    return [''.join(row) for row in b]


def cases(r):
    out = [fmt([['XOO', '.XO', '..X'], ['XOX', 'XOO', 'OXX'], ['X.O', 'OX.', '...']]),
           fmt([['X'], ['.'], ['..X', '.X.', 'X..'], ['XO', '.X'], ['XO', 'OO']])]
    for n in (3, 4, 10, 100):
        bs = [random_board(r, n, 0.9) for _ in range(3)]
        bs += [plant(r, n, r.choice('XO'), kind) for kind in ('row', 'col', 'diag', 'anti')]
        # A full board with no line: a draw.
        bs.append([''.join('XO'[(i // 2 + j) % 2] for j in range(n)) for i in range(n)])
        out.append(fmt(bs))
    return out
