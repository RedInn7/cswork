LEVEL = '简单'
TAGS = ['位运算', '数学']
SAMPLES = 1
MAX_N = 8000


def wrap(x):
    x &= 0xFFFFFFFF
    return x - (1 << 32) if x >= 1 << 31 else x


def pairs(s):
    v = list(map(int, s.split()))
    return [(v[1 + 2 * k], v[2 + 2 * k]) for k in range(v[0])]


def solve(s):
    return '\n'.join(str(max(a, b)) for a, b in pairs(s))


def wrong_sign_bit_32(s):
    # Picks by the sign bit of a - b computed in 32 bits.
    return '\n'.join(str(b if wrap(a - b) < 0 else a) for a, b in pairs(s))


def wrong_formula_32(s):
    # (a + b + |a - b|) / 2 with every step in 32 bits.
    out = []
    for a, b in pairs(s):
        d = wrap(a - b)
        total = wrap(wrap(a + b) + wrap(abs(d)))
        out.append(str(int(total / 2)))
    return '\n'.join(out)


def fmt(ps):
    return f'{len(ps)}\n' + ''.join(f'{a} {b}\n' for a, b in ps)


def cases(r):
    lo, hi = -2**31, 2**31 - 1
    out = [fmt([(7, -3), (hi, lo)]), fmt([(0, 0), (-5, -5), (lo, hi), (hi, -1), (-1, hi), (lo, 1), (7, -3)])]
    for t, v in [(20, 100), (1000, 10**9), (8000, hi)]:
        out.append(fmt([(r.randint(-v, min(v, hi)), r.randint(-v, min(v, hi))) for _ in range(t)]))
    return out
