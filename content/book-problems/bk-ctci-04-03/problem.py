LEVEL = '中等'
TAGS = ['二叉树', '广度优先搜索']
SAMPLES = 1
MAX_N = 10000


def parse(s):
    a = list(map(int, s.split()))
    return a[1], a[2::3], a[3::3], a[4::3]


def levels(s, right_first=False):
    root, v, left, right = parse(s)
    out, level = [], [root]
    while level:
        out.append([v[i - 1] for i in level])
        nxt = []
        for i in level:
            kids = (right[i - 1], left[i - 1]) if right_first else (left[i - 1], right[i - 1])
            nxt += [c for c in kids if c]
        level = nxt
    return out


def show(rows):
    return '\n'.join([str(len(rows))] + [' '.join(map(str, [len(row)] + row)) for row in rows])


def solve(s):
    return show(levels(s))


def wrong_right_to_left(s):
    return show(levels(s, right_first=True))


def wrong_drops_last_level(s):
    # Appends a level only when the next one is found, so the deepest level is lost.
    rows = levels(s)
    return show(rows[:-1])


def table(r, n, shape):
    ids = list(range(1, n + 1))
    r.shuffle(ids)
    left, right = [0] * (n + 1), [0] * (n + 1)
    for k in range(1, n):
        if shape == 'full':
            p, side = ids[(k - 1) // 2], (left if k % 2 else right)
        elif shape == 'right':
            p, side = ids[k - 1], right
        else:
            while True:
                p, side = ids[r.randrange(k)], r.choice((left, right))
                if not side[p]:
                    break
        side[p] = ids[k]
    rows = ''.join(f'{r.randint(-10**9, 10**9)} {left[i]} {right[i]}\n' for i in range(1, n + 1))
    return f'{n} {ids[0]}\n' + rows


def cases(r):
    out = ['7 1\n10 2 3\n20 4 5\n30 0 6\n40 7 0\n50 0 0\n60 0 0\n70 0 0\n', '1 1\n5 0 0\n', '2 2\n9 0 0\n4 0 1\n',
           '3 1\n1 2 3\n2 0 0\n3 0 0\n']
    for n, shape in [(10, 'random'), (31, 'full'), (500, 'right'), (3000, 'random'), (10000, 'random')]:
        out.append(table(r, n, shape))
    return out
