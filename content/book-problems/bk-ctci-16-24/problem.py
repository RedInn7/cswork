from collections import Counter

LEVEL = '中等'
TAGS = ['哈希表', '双指针', '排序']
SAMPLES = 2


def parse(s):
    v = list(map(int, s.split()))
    return v[2:2 + v[0]], v[1]


def pairs(a, t, halve=True, distinct=False):
    cnt = Counter(a)
    out = []
    for x in sorted(cnt):
        y = t - x
        if x > y or y not in cnt:
            continue
        k = (cnt[x] // 2 if halve else cnt[x]) if x == y else min(cnt[x], cnt[y])
        out += [(x, y)] * (min(k, 1) if distinct else k)
    return out


def show(ps):
    return '\n'.join([str(len(ps))] + [f'{x} {y}' for x, y in ps])


def solve(s):
    return show(pairs(*parse(s)))


def wrong_middle_not_halved(s):
    # Pairs a value with itself cnt[x] times when x = target - x.
    return show(pairs(*parse(s), halve=False))


def wrong_distinct_pairs(s):
    return show(pairs(*parse(s), distinct=True))


def fmt(a, t):
    return f'{len(a)} {t}\n{" ".join(map(str, a))}\n'


def cases(r):
    out = [fmt([5, 6, 5, 7, 7, 6], 12), fmt([3, 1, 2], 6), fmt([1], 2), fmt([2, 2, 2], 4), fmt([0, 0, 0, 0], 0),
           fmt([-1, 1, -1, 1, 1], 0)]
    for n, v in [(10, 5), (1000, 50), (20000, 10**9), (20000, 300)]:
        a = [r.randint(-v, v) for _ in range(n)]
        out.append(fmt(a, r.choice(a) + r.choice(a)))
    return out
