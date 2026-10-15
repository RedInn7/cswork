LEVEL = '中等'
TAGS = ['二分查找', '数组']
SAMPLES = 2


def parse(s):
    a = list(map(int, s.split()))
    return a[2:a[0] + 2], a[1]


def solve(s):
    a, t = parse(s)
    return str(a.index(t) if t in a else -1)


def search(a, t, duplicates):
    lo, hi = 0, len(a) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if a[mid] == t:
            return mid
        if duplicates and a[lo] == a[mid] == a[hi]:
            lo, hi = lo + 1, hi - 1
        elif a[lo] <= a[mid]:
            if a[lo] <= t < a[mid]:
                hi = mid - 1
            else:
                lo = mid + 1
        elif a[mid] < t <= a[hi]:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1


def wrong_any_index(s):
    # Handles repeats but returns the first index it meets, not the smallest.
    a, t = parse(s)
    return str(search(a, t, True))


def wrong_no_repeats(s):
    # The textbook search for distinct values.
    a, t = parse(s)
    return str(search(a, t, False))


def fmt(a, t):
    return f'{len(a)} {t}\n{" ".join(map(str, a))}\n'


def cases(r):
    out = [fmt([15, 16, 19, 20, 25, 1, 3, 4, 5, 7, 10, 14], 5), fmt([5, 5, 5, 1, 2, 3, 4, 5], 5), fmt([1], 1), fmt([1], 2),
           fmt([2, 2, 2, 2, 3, 2], 3), fmt([1, 1, 1, 1, 1, 0, 1], 0), fmt([3, 1, 1], 3), fmt([1, 2, 3, 4], 4)]
    for n, v in [(10, 5), (100, 20), (1000, 3), (20000, 10**9), (20000, 50)]:
        for _ in range(2 if n < 20000 else 1):
            a = sorted(r.randint(-v, v) for _ in range(n))
            k = r.randrange(n)
            a = a[k:] + a[:k]
            out.append(fmt(a, r.choice(a) if r.random() < 0.8 else r.randint(-v, v)))
    return out
