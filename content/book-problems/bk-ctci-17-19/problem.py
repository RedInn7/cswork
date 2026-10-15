LEVEL = '困难'
TAGS = ['数学', '位运算']
SAMPLES = 2


def parse(s):
    v = list(map(int, s.split()))
    return v[0], v[1:v[0] - 1]


def solve(s):
    n, a = parse(s)
    total = n * (n + 1) // 2 - sum(a)
    half = total // 2
    small = half * (half + 1) // 2 - sum(x for x in a if x <= half)
    return f'{small} {total - small}'


def wrong_one_missing(s):
    # Treats the sum difference as one number and pairs it with the largest absent value.
    n, a = parse(s)
    total = n * (n + 1) // 2 - sum(a)
    return f'{min(total, n)} {n}'


def wrong_squares_int32(s):
    # Solves x + y and x^2 + y^2 with the squares summed in 32-bit integers.
    n, a = parse(s)
    wrap = lambda x: ((x + 2**31) % 2**32) - 2**31
    s1 = n * (n + 1) // 2 - sum(a)
    sq = 0
    for k in range(1, n + 1):
        sq = wrap(sq + k * k)
    for x in a:
        sq = wrap(sq - x * x)
    d2 = 2 * sq - s1 * s1
    d = int(round(abs(d2) ** 0.5))
    return f'{(s1 - d) // 2} {(s1 + d) // 2}'


def fmt(n, gone):
    rest = [x for x in range(1, n + 1) if x not in gone]
    return f'{n}\n{" ".join(map(str, rest))}\n'


def cases(r):
    out = []
    for n, gone in [(6, (2, 5)), (3, (1, 3)), (4, (3, 4)), (5, (1, 2)), (100, (50, 51))]:
        rest = [x for x in range(1, n + 1) if x not in gone]
        if n == 6:
            rest = [6, 1, 3, 4]
        out.append(f'{n}\n{" ".join(map(str, rest))}\n')
    for n, top in [(10, False), (1000, False), (10000, False), (50000, True)]:
        # Two missing values near 50000 push x^2 + y^2 past 2^31.
        gone = {n - 1, n - r.randint(2, 100)} if top else set(r.sample(range(1, n + 1), 2))
        rest = [x for x in range(1, n + 1) if x not in gone]
        r.shuffle(rest)
        out.append(f'{n}\n{" ".join(map(str, rest))}\n')
    return out
