LEVEL = '简单'
TAGS = ['堆', '排序']
SAMPLES = 2
MAX_N = 20000


def parse(s):
    a = s.split()
    n, k = int(a[0]), int(a[1])
    return a[2:n + 2], k


def solve(s):
    a, k = parse(s)
    return ' '.join(map(str, sorted(map(int, a))[:k]))


def wrong_distinct(s):
    # Drops repeats, as a set-based heap would.
    a, k = parse(s)
    return ' '.join(map(str, sorted(set(map(int, a)))[:k]))


def wrong_text_order(s):
    # Sorts the tokens as text.
    a, k = parse(s)
    return ' '.join(sorted(a)[:k])


def fmt(a, k):
    return f'{len(a)} {k}\n{" ".join(map(str, a))}\n'


def cases(r):
    out = [fmt([8, 4, 6, 3], 2), fmt([0, 5, 0, 3, 9], 3), fmt([7], 1), fmt([5, 5, 5, 5], 3), fmt([10, 9, 100, 2], 3),
           fmt([-1, -10, 3], 3)]
    for n, v in [(10, 20), (1000, 10**9), (1000, 3), (20000, 10**9)]:
        a = [r.randint(-v, v) for _ in range(n)]
        out.append(fmt(a, r.randint(1, n)))
    return out
