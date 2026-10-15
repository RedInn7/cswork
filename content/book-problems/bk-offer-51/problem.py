LEVEL = '困难'
TAGS = ['归并排序', '树状数组']
SAMPLES = 2


def parse(s):
    a = list(map(int, s.split()))
    return a[1:a[0] + 1]


def inversions(a, strict=True):
    """Fenwick tree over value ranks; with strict=False equal values count too."""
    ranks = {v: k + 1 for k, v in enumerate(sorted(set(a)))}
    tree = [0] * (len(ranks) + 1)
    total = 0
    for seen, v in enumerate(a):
        k = ranks[v]
        # Count the earlier values <= v (strict) or < v, then the rest are inversions.
        i, below = (k if strict else k - 1), 0
        while i:
            below += tree[i]
            i -= i & -i
        total += seen - below
        while k < len(tree):
            tree[k] += 1
            k += k & -k
    return total


def solve(s):
    return str(inversions(parse(s)))


def wrong_counts_ties(s):
    return str(inversions(parse(s), strict=False))


def wrong_int32(s):
    x = inversions(parse(s)) & 0xFFFFFFFF
    return str(x - (1 << 32) if x >= 1 << 31 else x)


def fmt(a):
    return f'{len(a)}\n{" ".join(map(str, a))}\n'


def cases(r):
    out = [fmt([9, 2, 6, 1]), fmt([3, 2, 2]), fmt([1]), fmt([1, 2, 3, 4]), fmt([4, 3, 2, 1]), fmt([5, 5, 5, 5]),
           fmt([-1, -2, 10**9, -10**9])]
    for n, v in [(10, 3), (1000, 10**9), (5000, 10), (20000, 10**6)]:
        out.append(fmt([r.randint(-v, v) for _ in range(n)]))
    # 7000 copies each of 9 down to 0: 45 * 7000^2 inversions, past 2^31.
    out.append(fmt([d for d in range(9, -1, -1) for _ in range(7000)]))
    return out
