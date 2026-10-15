LEVEL = '简单'
TAGS = ['数组', '摩尔投票']
SAMPLES = 2


def values(s):
    v = list(map(int, s.split()))
    return v[1:v[0] + 1]


def vote(a):
    cand, count = None, 0
    for x in a:
        if count == 0:
            cand = x
        count += 1 if x == cand else -1
    return cand


def solve(s):
    a = values(s)
    c = vote(a)
    return str(c if 2 * a.count(c) > len(a) else -1)


def wrong_no_check(s):
    return str(vote(values(s)))


def wrong_half_counts(s):
    # Accepts exactly half.
    a = values(s)
    c = max(set(a), key=a.count) if len(a) < 5000 else vote(a)
    return str(c if 2 * a.count(c) >= len(a) else -1)


def fmt(a):
    return f'{len(a)}\n{" ".join(map(str, a))}\n'


def cases(r):
    out = [fmt([8, 3, 8, 8, 1, 8, 2]), fmt([4, 6, 4, 6]), fmt([7]), fmt([1, 2]), fmt([2, 2]), fmt([1, 1, 2, 2]),
           fmt([4, 4, 4, 1, 2, 3])]
    for n in (10, 101, 2000, 20000):
        m = r.randint(1, 10**9)
        k = n // 2 + r.choice([0, 1, 2])
        a = [m] * k + [r.randint(1, 10**9) for _ in range(n - k)]
        r.shuffle(a)
        out.append(fmt(a))
        out.append(fmt([r.randint(1, 3) for _ in range(n)]))
    return out
