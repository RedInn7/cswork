LEVEL = '简单'
TAGS = ['位运算']
SAMPLES = 1


def pairs(s):
    a = list(map(int, s.split()))
    return [(a[1 + 2 * k], a[2 + 2 * k]) for k in range(a[0])]


def solve(s):
    return '\n'.join(str(bin((a ^ b) & 0xFFFFFFFF).count('1')) for a, b in pairs(s))


def wrong_unbounded_xor(s):
    # Counts the ones of the raw XOR: a negative result prints as -0b…, its magnitude.
    return '\n'.join(str(bin(a ^ b).count('1')) for a, b in pairs(s))


def wrong_31_bits(s):
    # Looks at the low 31 bits and misses the sign bit.
    return '\n'.join(str(bin((a ^ b) & 0x7FFFFFFF).count('1')) for a, b in pairs(s))


def fmt(ps):
    return f'{len(ps)}\n' + ''.join(f'{a} {b}\n' for a, b in ps)


def cases(r):
    lo, hi = -2**31, 2**31 - 1
    out = [fmt([(29, 15), (-1, 0), (1, 2)]), fmt([(0, 0), (lo, hi), (lo, 0), (hi, 0), (-1, -1), (-2, 1), (826966453, -729934991)])]
    for t in (20, 1000, 10000):
        out.append(fmt([(r.randint(lo, hi), r.randint(lo, hi)) for _ in range(t)]))
    return out
