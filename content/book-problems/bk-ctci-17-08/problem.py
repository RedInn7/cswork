from bisect import bisect_left, bisect_right

LEVEL = '中等'
TAGS = ['动态规划', '二分查找', '排序']
SAMPLES = 2
MAX_N = 100000


def people(s):
    v = list(map(int, s.split()))
    return [(v[1 + 2 * i], v[2 + 2 * i]) for i in range(v[0])]


def tower(ps, key, search):
    tails = []
    for _, w in sorted(ps, key=key):
        k = search(tails, w)
        if k == len(tails):
            tails.append(w)
        else:
            tails[k] = w
    return str(len(tails))


def solve(s):
    return tower(people(s), lambda p: (p[0], -p[1]), bisect_left)


def wrong_equal_heights_ascending(s):
    # Sorts equal heights by weight ascending, so two of the same height can stack.
    return tower(people(s), lambda p: (p[0], p[1]), bisect_left)


def wrong_equal_weights(s):
    # Lets equal weights extend the run.
    return tower(people(s), lambda p: (p[0], -p[1]), bisect_right)


def fmt(ps):
    return f'{len(ps)}\n' + ''.join(f'{h} {w}\n' for h, w in ps)


def cases(r):
    out = [fmt([(150, 45), (160, 52), (155, 50), (170, 70), (165, 60)]), fmt([(1, 1), (2, 2), (2, 3), (3, 2)]),
           fmt([(5, 5)]), fmt([(1, 5), (2, 5), (3, 5)]), fmt([(3, 1), (3, 2), (3, 3)]), fmt([(1, 1), (2, 2), (3, 3), (4, 4)])]
    for n, v in [(10, 5), (1000, 100), (12000, 10**6), (20000, 1000)]:
        out.append(fmt([(r.randint(1, v), r.randint(1, v)) for _ in range(n)]))
    return out
