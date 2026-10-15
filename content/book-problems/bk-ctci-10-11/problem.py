LEVEL = '中等'
TAGS = ['排序', '贪心']
SAMPLES = 2


def values(s):
    a = list(map(int, s.split()))
    return a[1:a[0] + 1]


def show(a):
    return ' '.join(map(str, a))


def solve(s):
    a = sorted(values(s))
    for i in range(1, len(a) - 1, 2):
        a[i], a[i + 1] = a[i + 1], a[i]
    return show(a)


def wrong_one_pass(s):
    # The O(n) neighbour swap: alternating, but not the smallest arrangement.
    a = values(s)
    for i in range(1, len(a), 2):
        j = max((k for k in (i - 1, i, i + 1) if k < len(a)), key=lambda k: a[k])
        a[i], a[j] = a[j], a[i]
    return show(a)


def wrong_peak_first(s):
    # Starts with a peak: swaps (0,1), (2,3), …
    a = sorted(values(s))
    for i in range(0, len(a) - 1, 2):
        a[i], a[i + 1] = a[i + 1], a[i]
    return show(a)


def fmt(a):
    return f'{len(a)}\n{show(a)}\n'


def cases(r):
    out = [fmt([4, 8, 2, 6, 6, 1]), fmt([9, 4]), fmt([7]), fmt([1, 1, 1]), fmt([3, 2, 1]), fmt([1, 2, 3, 4, 5, 6])]
    for n, v in [(9, 5), (100, 10**9), (1000, 3), (20000, 10**9)]:
        out.append(fmt([r.randint(-v, v) for _ in range(n)]))
    return out
