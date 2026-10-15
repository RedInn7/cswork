LEVEL = '简单'
TAGS = ['双指针', '二分查找']
SAMPLES = 2


def parse(s):
    a = list(map(int, s.split()))
    return a[2:2 + a[0]], a[1]


def solve(s):
    a, t = parse(s)
    i, j = 0, len(a) - 1
    while i < j:
        if a[i] + a[j] < t:
            i += 1
        elif a[i] + a[j] > t:
            j -= 1
        else:
            return f'{a[i]} {a[j]}'
    return '-1'


def wrong_same_element_twice(s):
    # Checks the complement in a set of all values, so one 3 makes 3 + 3.
    a, t = parse(s)
    values = set(a)
    for x in a:
        if t - x in values:
            return f'{min(x, t - x)} {max(x, t - x)}'
    return '-1'


def wrong_first_seen_pair(s):
    # Scans left to right and stops at the first value whose complement appeared before it.
    a, t = parse(s)
    seen = set()
    for x in a:
        if t - x in seen:
            return f'{t - x} {x}'
        seen.add(x)
    return '-1'


def fmt(a, t):
    return f'{len(a)} {t}\n{" ".join(map(str, a))}\n'


def cases(r):
    out = [fmt([2, 4, 5, 7, 11], 9), fmt([1, 3, 4], 6), fmt([3, 3], 6), fmt([1, 2], 4), fmt([1, 1, 1, 9, 9], 10),
           fmt([5, 5, 5], 10)]
    for n, v in [(10, 20), (1000, 2000), (5000, 10**6), (20000, 10**6)]:
        a = sorted(r.randint(1, v) for _ in range(n))
        i, j = sorted(r.sample(range(n), 2))
        out.append(fmt(a, a[i] + a[j]))
    a = sorted(r.sample(range(1, 10**6, 2), 5000))
    out.append(fmt(a, 2 * r.randint(1, 10**6)))
    return out
