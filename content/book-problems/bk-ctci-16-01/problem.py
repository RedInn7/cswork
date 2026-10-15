LEVEL = '简单'
TAGS = ['位运算', '数组']
SAMPLES = 1


def parse(s):
    a = list(map(int, s.split()))
    n, q = a[0], a[1]
    return a[2:2 + n], [(a[2 + n + 2 * k], a[3 + n + 2 * k]) for k in range(q)]


def solve(s):
    a, ops = parse(s)
    for i, j in ops:
        a[i - 1], a[j - 1] = a[j - 1], a[i - 1]
    return ' '.join(map(str, a))


def wrong_xor_same_slot(s):
    a, ops = parse(s)
    for i, j in ops:
        i, j = i - 1, j - 1
        a[i] ^= a[j]
        a[j] ^= a[i]
        a[i] ^= a[j]
    return ' '.join(map(str, a))


def wrong_zero_based(s):
    # Uses the positions as 0-based indices; position n wraps around in Python.
    a, ops = parse(s)
    for i, j in ops:
        a[i % len(a)], a[j % len(a)] = a[j % len(a)], a[i % len(a)]
    return ' '.join(map(str, a))


def fmt(a, ops):
    return f'{len(a)} {len(ops)}\n{" ".join(map(str, a))}\n' + ''.join(f'{i} {j}\n' for i, j in ops)


def cases(r):
    out = [fmt([1, 2, 3], [(1, 3), (2, 2)]), fmt([5], [(1, 1)]), fmt([4, 7], [(1, 2), (2, 1), (1, 2)]),
           fmt([9, 8, 7, 6], [(4, 4), (1, 4)])]
    for n, q in [(10, 10), (100, 300), (5000, 5000), (8000, 8000)]:
        a = [r.randint(0, 10**9) for _ in range(n)]
        ops = [(r.randint(1, n), r.randint(1, n)) for _ in range(q)]
        out.append(fmt(a, ops))
    return out
