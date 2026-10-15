LEVEL = '简单'
TAGS = ['链表', '双指针']
SAMPLES = 1


def parse(s):
    a = s.split()
    n, k = int(a[0]), int(a[1])
    return a[2:n + 2], k


def solve(s):
    values, k = parse(s)
    return values[-k]


def wrong_from_head(s):
    values, k = parse(s)
    return values[k - 1]


def wrong_one_too_far(s):
    # Walks n - k + 1 steps from the head instead of n - k.
    values, k = parse(s)
    return values[min(len(values) - k + 1, len(values) - 1)]


def fmt(values, k):
    return f'{len(values)} {k}\n{" ".join(map(str, values))}\n'


def cases(r):
    out = [fmt([7, 2, 9, 4], 3), fmt([8], 1), fmt([4, 6], 2), fmt([4, 6], 1), fmt([1, 2, 3], 3)]
    for n in (7, 300, 2000):
        values = r.sample(range(-10**9, 10**9), n)
        for k in (1, r.randint(2, n - 1), n):
            out.append(fmt(values, k))
    out.append(fmt(r.sample(range(-10**9, 10**9), 20000), 12345))
    return out
