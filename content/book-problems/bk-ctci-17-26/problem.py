from math import gcd

LEVEL = '困难'
TAGS = ['哈希表', '倒排索引', '数学']
SAMPLES = 1


def docs(s):
    lines = s.split('\n')
    out = []
    for line in lines[1:int(lines[0]) + 1]:
        v = list(map(int, line.split()))
        out.append(v[1:1 + v[0]])
    return out


def similar(ds, union_minus=True, zero_pairs=False):
    holders = {}
    for i, d in enumerate(ds):
        for x in d:
            holders.setdefault(x, []).append(i)
    common = {}
    for idx in holders.values():
        for a in range(len(idx)):
            for b in range(a + 1, len(idx)):
                key = (idx[a], idx[b])
                common[key] = common.get(key, 0) + 1
    if zero_pairs:
        for i in range(len(ds)):
            for j in range(i + 1, len(ds)):
                common.setdefault((i, j), 0)
    lines = []
    for (i, j), c in sorted(common.items()):
        q = len(ds[i]) + len(ds[j]) - (c if union_minus else 0)
        g = gcd(c, q) or 1
        lines.append(f'{i} {j} {c // g}/{q // g}')
    return '\n'.join([str(len(lines))] + lines)


def solve(s):
    return similar(docs(s))


def wrong_union_is_sum(s):
    return similar(docs(s), union_minus=False)


def wrong_lists_zero_pairs(s):
    # Prints every pair, including the ones that share nothing.
    return similar(docs(s), zero_pairs=True)


def fmt(ds):
    return f'{len(ds)}\n' + ''.join(' '.join(map(str, [len(d)] + d)) + '\n' for d in ds)


def cases(r):
    out = [fmt([[1, 2, 3], [2, 3, 4, 5], [3, 9], [7]]), fmt([[5]]), fmt([[1, 2], [2, 1]]), fmt([[1], [2], [3]]),
           fmt([[0, 100000], [100000], [0]])]
    for n, k, v in [(8, 5, 20), (100, 30, 500), (500, 60, 100000), (300, 10, 200)]:
        out.append(fmt([r.sample(range(v + 1), r.randint(1, k)) for _ in range(n)]))
    return out
