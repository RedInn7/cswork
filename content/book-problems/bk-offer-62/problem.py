LEVEL = '中等'
TAGS = ['数学', '递推']
SAMPLES = 1


def pairs(s):
    a = list(map(int, s.split()))
    return [(a[1 + 2 * i], a[2 + 2 * i]) for i in range(a[0])]


def last(n, m, fixed_modulus=False):
    f = 0
    for i in range(2, n + 1):
        f = (f + m) % (n if fixed_modulus else i)
    return f


def solve(s):
    return '\n'.join(str(last(n, m)) for n, m in pairs(s))


def wrong_one_based(s):
    # Numbers people from 1.
    return '\n'.join(str(last(n, m) + 1) for n, m in pairs(s))


def wrong_fixed_modulus(s):
    return '\n'.join(str(last(n, m, fixed_modulus=True)) for n, m in pairs(s))


def fmt(ps):
    return f'{len(ps)}\n' + ''.join(f'{n} {m}\n' for n, m in ps)


def cases(r):
    out = [fmt([(5, 3), (10, 17)]), fmt([(1, 1), (1, 1000000), (2, 1), (2, 2), (7, 1), (7, 7)]),
           fmt([(100000, 1), (100000, 1000000), (99999, 2)])]
    for t, n, m in [(10, 20, 20), (10, 1000, 10**6), (10, 100000, 10**6)]:
        out.append(fmt([(r.randint(1, n), r.randint(1, m)) for _ in range(t)]))
    return out
