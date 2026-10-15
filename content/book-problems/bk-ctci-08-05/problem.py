LEVEL = '中等'
TAGS = ['递归', '位运算', '数学']
SAMPLES = 1


def pairs(s):
    a = list(map(int, s.split()))
    return [(a[1 + 2 * k], a[2 + 2 * k]) for k in range(a[0])]


def solve(s):
    return '\n'.join(str(a * b) for a, b in pairs(s))


def wrong_int32(s):
    out = []
    for a, b in pairs(s):
        x = (a * b) & 0xFFFFFFFF
        out.append(str(x - (1 << 32) if x >= 1 << 31 else x))
    return '\n'.join(out)


def halving(a, b):
    # Drops the extra a when b is odd (b > 1).
    if b == 1:
        return a
    half = halving(a, b >> 1)
    return half + half


def wrong_halving_drops_odd(s):
    return '\n'.join(str(halving(a, b)) for a, b in pairs(s))


def fmt(ps):
    return f'{len(ps)}\n' + ''.join(f'{a} {b}\n' for a, b in ps)


def cases(r):
    out = [fmt([(6, 7), (13, 1), (10**9, 10**9)]), fmt([(1, 1), (2, 1), (7, 3), (65536, 65536), (46341, 46341)])]
    for t, hi in [(20, 100), (1000, 10**5), (10000, 10**9)]:
        out.append(fmt([(r.randint(1, hi), r.randint(1, hi)) for _ in range(t)]))
    return out
