LEVEL = '简单'
TAGS = ['位运算']
SAMPLES = 1


def queries(s):
    a = list(map(int, s.split()))
    return [a[1 + 4 * k:5 + 4 * k] for k in range(a[0])]


def insert(n, m, i, j, clear_to):
    mask = ((1 << (clear_to - i + 1)) - 1) << i if clear_to >= i else 0
    return (n & ~mask) | (m << i)


def solve(s):
    return '\n'.join(str(insert(n, m, i, j, j)) for n, m, i, j in queries(s))


def wrong_or_only(s):
    return '\n'.join(str(n | (m << i)) for n, m, i, j in queries(s))


def wrong_mask_short(s):
    # Clears bits i..j-1 only: the mask is one bit too narrow.
    return '\n'.join(str(insert(n, m, i, j, j - 1)) for n, m, i, j in queries(s))


def fmt(qs):
    return f'{len(qs)}\n' + ''.join(' '.join(map(str, q)) + '\n' for q in qs)


def cases(r):
    out = [fmt([(512, 5, 1, 3), (31, 0, 1, 3)]), fmt([(0, 31, 0, 4), (2**31 - 1, 0, 0, 30), (2**31 - 1, 5, 0, 2),
                                                        (0, 1, 30, 30), (2**30, 0, 30, 30), (7, 1, 1, 1)])]
    for t in (20, 1000, 10000):
        qs = []
        for _ in range(t):
            i = r.randint(0, 30)
            j = r.randint(i, 30)
            qs.append((r.randrange(2**31), r.randrange(2 ** (j - i + 1)), i, j))
        out.append(fmt(qs))
    return out
