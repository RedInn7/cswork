from bisect import bisect_left, bisect_right

LEVEL = '简单'
TAGS = ['二分查找', '数组']
SAMPLES = 1
MAX_N = (100000, 100000)


def parse(s):
    a = list(map(int, s.split()))
    n, q = a[0], a[1]
    return a[2:2 + n], a[2 + n:2 + n + q]


def solve(s):
    a, qs = parse(s)
    return '\n'.join(str(bisect_right(a, x) - bisect_left(a, x)) for x in qs)


def wrong_exists(s):
    # Answers whether x is present, not how often.
    a, qs = parse(s)
    return '\n'.join(str(int(bisect_right(a, x) > bisect_left(a, x))) for x in qs)


def wrong_upper_only(s):
    # Uses the upper bound alone: counts every value <= x.
    a, qs = parse(s)
    return '\n'.join(str(bisect_right(a, x)) for x in qs)


def fmt(a, qs):
    return f'{len(a)} {len(qs)}\n{" ".join(map(str, a))}\n{" ".join(map(str, qs))}\n'


def cases(r):
    out = [fmt([2, 4, 4, 4, 6, 9], [4, 5, 9, 2]), fmt([1], [1, 0, 2]), fmt([2, 2, 2], [2, 1, 3]),
           fmt([-5, -5, 0, 3, 3, 3], [-5, 3, 0, -6, 4])]
    for n, q, v in [(10, 10, 5), (1000, 1000, 100), (3000, 3000, 10**9), (100000, 100000, 1000)]:
        a = sorted(r.randint(-v, v) for _ in range(n))
        qs = [r.choice(a) if r.random() < 0.7 else r.randint(-v - 2, v + 2) for _ in range(q)]
        out.append(fmt(a, qs))
    return out
