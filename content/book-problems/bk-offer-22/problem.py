LEVEL = '简单'
TAGS = ['链表', '双指针']
SAMPLES = 1


def parse(s):
    a = s.split()
    n, k = int(a[0]), int(a[1])
    return a[2:n + 2], k


def solve(s):
    values, k = parse(s)
    return ' '.join(values[len(values) - k:])


def wrong_from_head(s):
    # Starts from the k-th node from the head.
    values, k = parse(s)
    return ' '.join(values[k - 1:])


def wrong_one_step_short(s):
    # Lets the fast pointer run k - 1 steps ahead, landing one node too far.
    values, k = parse(s)
    return ' '.join(values[len(values) - k + 1:])


def fmt(values, k):
    return f'{len(values)} {k}\n{" ".join(map(str, values))}\n'


def cases(r):
    out = [fmt([3, 8, 1, 6, 4], 3), fmt([9], 1), fmt([3, 1], 2), fmt([3, 1], 1), fmt([5, 6, 7, 8], 4)]
    for n in [6, 100, 1000]:
        values = [r.randint(-10**9, 10**9) for _ in range(n)]
        for k in (1, r.randint(1, n), n):
            out.append(fmt(values, k))
    n = 15000
    out.append(fmt([r.randint(-10**9, 10**9) for _ in range(n)], r.randint(1, n)))
    return out
