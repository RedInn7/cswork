LEVEL = '中等'
TAGS = ['二叉树', '广度优先搜索']
SAMPLES = 1
MAX_N = 8000


def parse(s):
    a = list(map(int, s.split()))
    n, root = a[0], a[1]
    return root, a[2::3], a[3::3], a[4::3]


def solve(s):
    root, v, left, right = parse(s)
    queue = [root]
    for i in queue:
        queue += [c for c in (left[i - 1], right[i - 1]) if c]
    return ' '.join(str(v[i - 1]) for i in queue)


def wrong_preorder(s):
    root, v, left, right = parse(s)
    out, stack = [], [root]
    while stack:
        i = stack.pop()
        out.append(v[i - 1])
        stack += [c for c in (right[i - 1], left[i - 1]) if c]
    return ' '.join(map(str, out))


def wrong_right_first(s):
    # Enqueues the right child before the left one.
    root, v, left, right = parse(s)
    queue = [root]
    for i in queue:
        queue += [c for c in (right[i - 1], left[i - 1]) if c]
    return ' '.join(str(v[i - 1]) for i in queue)


def table(r, n, shape):
    """Numbers 1..n shuffled onto a tree; shape: 'random', 'left' chain or 'full'."""
    ids = list(range(1, n + 1))
    r.shuffle(ids)
    left, right = [0] * (n + 1), [0] * (n + 1)
    for k in range(1, n):
        if shape == 'full':
            p = ids[(k - 1) // 2]
            side = left if k % 2 else right
        elif shape == 'left':
            p, side = ids[k - 1], left
        else:
            while True:
                p, side = ids[r.randrange(k)], r.choice((left, right))
                if not side[p]:
                    break
        side[p] = ids[k]
    rows = ''.join(f'{r.randint(-10**9, 10**9)} {left[i]} {right[i]}\n' for i in range(1, n + 1))
    return f'{n} {ids[0]}\n' + rows


def cases(r):
    out = ['5 2\n2 0 0\n4 1 4\n5 0 0\n7 3 5\n1 0 0\n', '1 1\n-4 0 0\n', '3 3\n2 0 0\n1 0 0\n0 2 1\n',
           '3 1\n1 0 2\n2 0 3\n3 0 0\n']
    for n, shape in [(7, 'full'), (10, 'random'), (300, 'left'), (1000, 'random'), (8000, 'random'), (4095, 'full')]:
        out.append(table(r, n, shape))
    return out
