LEVEL = '中等'
TAGS = ['数组', '双指针', '排序']
SAMPLES = 2
MAX_N = 20000


def values(s):
    v = list(map(int, s.split()))
    return v[1:v[0] + 1]


def bounds(a, strict=True):
    lo = hi = -1
    top = a[0]
    for i, x in enumerate(a):
        if x < top or (not strict and x == top and i):
            hi = i
        top = max(top, x)
    low = a[-1]
    for i in range(len(a) - 1, -1, -1):
        if a[i] > low or (not strict and a[i] == low and i < len(a) - 1):
            lo = i
        low = min(low, a[i])
    return f'{lo} {hi}' if hi != -1 else '-1 -1'


def solve(s):
    return bounds(values(s))


def wrong_moves_equal_values(s):
    # Also pulls in elements equal to the running maximum or minimum.
    return bounds(values(s), strict=False)


def wrong_descents_only(s):
    # Takes the first and last descent and never widens them by the range's minimum and maximum.
    a = values(s)
    down = [i for i in range(1, len(a)) if a[i] < a[i - 1]]
    return f'{down[0] - 1} {down[-1]}' if down else '-1 -1'


def fmt(a):
    return f'{len(a)}\n{" ".join(map(str, a))}\n'


def cases(r):
    out = [fmt([2, 3, 9, 5, 8, 4, 10, 12]), fmt([1, 2, 2, 3]), fmt([5]), fmt([2, 1]), fmt([1, 3, 3, 2, 3]),
           fmt([1, 1, 1, 0, 1, 1]), fmt([3, 2, 1]), fmt([1, 2, 5, 3, 4, 6])]
    for n, v in [(10, 5), (1000, 10**9), (20000, 50)]:
        a = sorted(r.randint(-v, v) for _ in range(n))
        i, j = sorted(r.sample(range(n), 2))
        seg = a[i:j + 1]
        r.shuffle(seg)
        out.append(fmt(a[:i] + seg + a[j + 1:]))
        out.append(fmt([r.randint(-v, v) for _ in range(n)]))
    return out
