from functools import cmp_to_key

LEVEL = '中等'
TAGS = ['排序', '贪心', '字符串']
SAMPLES = 2
MAX_N = 20000


def tokens(s):
    a = s.split()
    return a[1:int(a[0]) + 1]


def solve(s):
    return ''.join(sorted(tokens(s), key=cmp_to_key(lambda a, b: -1 if a + b < b + a else (a + b > b + a))))


def wrong_text_order(s):
    return ''.join(sorted(tokens(s)))


def wrong_value_order(s):
    return ''.join(sorted(tokens(s), key=int))


def fmt(a):
    return f'{len(a)}\n{" ".join(map(str, a))}\n'


def cases(r):
    out = [fmt([7, 70, 75, 2, 8]), fmt([1, 0, 2, 0]), fmt([10, 2]), fmt([0]), fmt([121, 12]), fmt([12, 121]),
           fmt([824, 8247]), fmt([0, 0, 0]), fmt([1000000000, 1, 10, 100])]
    for n, pool in [(10, [1, 10, 100, 11, 110, 101]), (50, list(range(0, 40))), (1000, None), (20000, None)]:
        a = [r.choice(pool) if pool else r.choice([r.randint(0, 10**9), r.randint(0, 99), r.randint(0, 999)])
             for _ in range(n)]
        out.append(fmt(a))
    return out
