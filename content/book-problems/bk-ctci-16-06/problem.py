LEVEL = '中等'
TAGS = ['双指针', '排序']
SAMPLES = 2


def parse(s):
    v = list(map(int, s.split()))
    n, m = v[0], v[1]
    return sorted(v[2:2 + n]), sorted(v[2 + n:2 + n + m])


def closest(a, b, diff):
    i = j = 0
    best = None
    while i < len(a) and j < len(b):
        d = diff(a[i], b[j])
        best = d if best is None else min(best, d)
        if a[i] < b[j]:
            i += 1
        else:
            j += 1
    return str(best)


def solve(s):
    return closest(*parse(s), lambda x, y: abs(x - y))


def wrong_int32(s):
    def diff(x, y):
        d = (x - y) & 0xFFFFFFFF
        d = d - (1 << 32) if d >= 1 << 31 else d
        return abs(d)
    return closest(*parse(s), diff)


def wrong_same_rank(s):
    # Pairs the i-th smallest of a with the i-th smallest of b only.
    a, b = parse(s)
    return str(min(abs(x - y) for x, y in zip(a, b)))


def fmt(a, b):
    return f'{len(a)} {len(b)}\n{" ".join(map(str, a))}\n{" ".join(map(str, b))}\n'


def cases(r):
    lo, hi = -2**31, 2**31 - 1
    out = [fmt([1, 3, 15, 11, 2], [23, 127, 235, 19, 8]), fmt([hi], [lo]), fmt([5], [5]), fmt([1, 2, 3], [10]),
           fmt([lo, hi], [0]), fmt([-1, 2**31 - 2], [hi - 3, lo + 2])]
    for n, m, v in [(10, 10, 100), (1000, 50, 10**9), (10000, 10000, 2**31 - 1), (100, 100, 2**31 - 1)]:
        out.append(fmt([r.randint(-v, min(v, hi)) for _ in range(n)], [r.randint(-v, min(v, hi)) for _ in range(m)]))
    out.append(fmt([r.randint(2**30, hi) for _ in range(50)], [r.randint(lo, -2**30) for _ in range(50)]))
    return out
