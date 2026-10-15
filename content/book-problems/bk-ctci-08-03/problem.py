LEVEL = '简单'
TAGS = ['二分查找', '递归']
SAMPLES = 2


def values(s):
    a = list(map(int, s.split()))
    return a[1:a[0] + 1]


def solve(s):
    return str(next((i for i, v in enumerate(values(s)) if v == i), -1))


def wrong_binary_search(s):
    # Binary search that assumes distinct values.
    a = values(s)
    lo, hi, found = 0, len(a) - 1, -1
    while lo <= hi:
        mid = (lo + hi) // 2
        if a[mid] == mid:
            found, hi = mid, mid - 1
        elif a[mid] < mid:
            lo = mid + 1
        else:
            hi = mid - 1
    return str(found)


def wrong_last_match(s):
    a = values(s)
    return str(next((i for i in range(len(a) - 1, -1, -1) if a[i] == i), -1))


def fmt(a):
    return f'{len(a)}\n{" ".join(map(str, a))}\n'


def cases(r):
    out = [fmt([-3, 0, 2, 5, 9]), fmt([-1, 1, 1, 5]), fmt([0, 1, 1, 5]), fmt([1, 1, 1]), fmt([0]), fmt([5]), fmt([-1, 1, 1, 1, 4]),
           fmt([2, 2, 2, 2, 2]), fmt([-10, -5, 3, 3, 3, 5])]
    for n, spread, k in [(10, 3, 2), (100, 20, 2), (1000, 1000, 2), (20000, 5, 1), (20000, 30000, 1)]:
        for _ in range(k):
            out.append(fmt(sorted(r.randint(-spread, n + spread) for _ in range(n))))
    return out
