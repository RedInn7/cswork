LEVEL = '简单'
TAGS = ['二分查找', '数组']
SAMPLES = 2


def parse(s):
    a = list(map(int, s.split()))
    return a[1:a[0] + 1]


def solve(s):
    a = parse(s)
    lo, hi = 0, len(a)
    while lo < hi:
        mid = (lo + hi) // 2
        if a[mid] == mid:
            lo = mid + 1
        else:
            hi = mid
    return str(lo)


def wrong_gap_inside(s):
    # Only looks for a gap between two values, so a missing n is never found.
    a = parse(s)
    for i, v in enumerate(a):
        if v != i:
            return str(i)
    return str(len(a) - 1)


def wrong_sum_off_by_one(s):
    # Sums 0..n-1 instead of 0..n.
    a = parse(s)
    n = len(a)
    return str(n * (n - 1) // 2 - sum(a))


def fmt(a):
    return f'{len(a)}\n{" ".join(map(str, a))}\n'


def cases(r):
    out = [fmt([0, 1, 2, 4, 5]), fmt([0, 1, 2]), fmt([1]), fmt([0]), fmt([1, 2, 3]), fmt([0, 2])]
    for n, gap in [(10, 0), (100, 100), (1000, None), (1000, 1000), (30000, None), (30000, 30000)]:
        gap = r.randint(1, n - 1) if gap is None else gap
        out.append(fmt([v for v in range(n + 1) if v != gap]))
    return out
