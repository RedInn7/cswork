LEVEL = '中等'
TAGS = ['链表', '双指针']
SAMPLES = 1


def parse(s):
    a = list(map(int, s.split()))
    return a[2:a[0] + 2], a[1]


def show(a):
    return ' '.join(map(str, a))


def solve(s):
    a, x = parse(s)
    return show([v for v in a if v < x] + [v for v in a if v >= x])


def wrong_equal_goes_first(s):
    a, x = parse(s)
    return show([v for v in a if v <= x] + [v for v in a if v > x])


def wrong_head_insertion(s):
    # Moves each small node to the head as it is found, reversing the first part.
    a, x = parse(s)
    return show([v for v in a if v < x][::-1] + [v for v in a if v >= x])


def fmt(a, x):
    return f'{len(a)} {x}\n{show(a)}\n'


def cases(r):
    out = [fmt([1, 4, 3, 2, 5, 2], 3), fmt([2, 1], 2), fmt([5], 1), fmt([5], 9), fmt([3, 3, 3], 3), fmt([9, 8, 1, 2], 5)]
    for n, v in [(10, 10), (1000, 1000), (20000, 10**9), (5000, 5)]:
        a = [r.randint(-v, v) for _ in range(n)]
        out.append(fmt(a, r.choice(a)))
    return out
