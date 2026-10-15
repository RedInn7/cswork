LEVEL = '中等'
TAGS = ['哈希表', '数学']
SAMPLES = 2
MAX_N = (100000, 100000)


def parse(s):
    v = list(map(int, s.split()))
    n, m = v[0], v[1]
    return v[2:2 + n], v[2 + n:2 + n + m]


def find(a, b, check_parity=True, smallest=True):
    diff = sum(a) - sum(b)
    if check_parity and diff % 2:
        return '-1'
    half = diff // 2
    have = set(b)
    for x in (sorted(set(a)) if smallest else a):
        if x - half in have:
            return f'{x} {x - half}'
    return '-1'


def solve(s):
    return find(*parse(s))


def wrong_odd_difference(s):
    return find(*parse(s), check_parity=False)


def wrong_first_in_order(s):
    # Returns the first a in input order, not the smallest.
    return find(*parse(s), smallest=False)


def fmt(a, b):
    return f'{len(a)} {len(b)}\n{" ".join(map(str, a))}\n{" ".join(map(str, b))}\n'


def cases(r):
    out = [fmt([7, 5, 2], [3, 8, 5]), fmt([1, 2, 3], [4, 1]), fmt([5], [5]), fmt([1, 1], [2, 2]),
           fmt([3, 9], [1, 2, 5]), fmt([-5, 7, 2], [0, -1])]
    for n, m, v in [(10, 10, 10), (1000, 800, 1000), (5000, 5000, 30)]:
        a = [r.randint(-v, v) for _ in range(n)]
        b = [r.randint(-v, v) for _ in range(m)]
        out.append(fmt(a, b))
        # Shift one value so the sums differ by a small even amount: many swaps then work.
        a[0] += 2 * r.randint(-3, 3) - (sum(a) - sum(b))
        if abs(a[0]) <= 100000:
            out.append(fmt(a, b))
    # n = m = 10^5 and no swap works (an even a minus an odd b never equals the even half), so
    # checking pair by pair has to try all 10^10.
    a = [2 * r.randrange(50001) for _ in range(100000)]
    b = [2 * r.randrange(50000) + 1 for _ in range(100000)]
    if (sum(a) - sum(b)) // 2 % 2:
        b[0] += 2 if b[0] < 99999 else -2
    out.append(fmt(a, b))
    return out
