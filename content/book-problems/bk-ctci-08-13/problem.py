LEVEL = '困难'
TAGS = ['动态规划', '排序']
SAMPLES = 2
MAX_N = 1000


def boxes(s):
    a = list(map(int, s.split()))
    return [tuple(a[1 + 3 * i:4 + 3 * i]) for i in range(a[0])]


def tallest(bs, fits):
    bs = sorted(bs, reverse=True)
    f = [h for _, _, h in bs]
    for i, (w, d, h) in enumerate(bs):
        for j in range(i):
            if f[j] + h > f[i] and fits(bs[i], bs[j]):
                f[i] = f[j] + h
    return str(max(f))


def solve(s):
    return tallest(boxes(s), lambda a, b: a[0] < b[0] and a[1] < b[1] and a[2] < b[2])


def wrong_not_strict(s):
    return tallest(boxes(s), lambda a, b: a[0] <= b[0] and a[1] <= b[1] and a[2] <= b[2])


def wrong_greedy(s):
    # After sorting by width, takes every box that fits on the current top.
    bs = sorted(boxes(s), reverse=True)
    top, total = bs[0], bs[0][2]
    for b in bs[1:]:
        if b[0] < top[0] and b[1] < top[1] and b[2] < top[2]:
            top, total = b, total + b[2]
    return str(total)


def fmt(bs):
    return f'{len(bs)}\n' + ''.join(f'{w} {d} {h}\n' for w, d, h in bs)


def cases(r):
    out = [fmt([(5, 6, 6), (3, 3, 3), (4, 5, 4)]), fmt([(2, 2, 2), (3, 2, 6), (4, 4, 1)]), fmt([(5, 5, 5)]),
           fmt([(2, 2, 2), (2, 2, 2)]), fmt([(10, 10, 1), (9, 1, 100), (8, 8, 1), (7, 7, 1)]),
           fmt([(4, 4, 4), (3, 5, 3), (2, 2, 9)])]
    for n, v in [(10, 5), (100, 20), (500, 1000), (1000, 10**6), (1000, 50)]:
        out.append(fmt([(r.randint(1, v), r.randint(1, v), r.randint(1, v)) for _ in range(n)]))
    return out
