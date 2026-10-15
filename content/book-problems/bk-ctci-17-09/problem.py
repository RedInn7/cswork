LEVEL = '中等'
TAGS = ['动态规划', '数学', '堆']
SAMPLES = 1
MAX_N = (1000, 2000)


def sequence(k, dedup=True):
    f = [1]
    i = [0, 0, 0]
    while len(f) < k:
        cand = [f[i[0]] * 3, f[i[1]] * 5, f[i[2]] * 7]
        x = min(cand)
        f.append(x)
        for j in range(3):
            if cand[j] == x:
                i[j] += 1
                if not dedup:
                    break
    return f


def queries(s):
    v = list(map(int, s.split()))
    return v[1:v[0] + 1]


def solve(s):
    qs = queries(s)
    f = sequence(max(qs))
    return '\n'.join(str(f[k - 1]) for k in qs)


def wrong_keeps_repeats(s):
    # Advances only one pointer on a tie, so 15 appears twice.
    qs = queries(s)
    f = sequence(max(qs), dedup=False)
    return '\n'.join(str(f[k - 1]) for k in qs)


def wrong_skips_one(s):
    # Starts the list at 3.
    qs = queries(s)
    f = sequence(max(qs) + 1)
    return '\n'.join(str(f[k]) for k in qs)


def fmt(qs):
    return f'{len(qs)}\n{" ".join(map(str, qs))}\n'


def size(s):
    t, *rest = map(int, s.split())
    return t, max(rest)


def cases(r):
    out = [fmt([6, 12, 1]), fmt([1, 2, 3, 4, 6, 7, 2000, 1999])]
    for t, hi in [(20, 50), (1000, 2000)]:
        out.append(fmt([r.randint(1, hi) for _ in range(t)]))
    return out
