LEVEL = '中等'
TAGS = ['数学', '位运算']
SAMPLES = 1


def queries(s):
    a = list(map(int, s.split()))
    return a[1:a[0] + 1]


def solve(s):
    return '\n'.join(str(n * (n + 1) // 2) for n in queries(s))


def wrong_int32(s):
    # Multiplies in 32-bit integers before widening.
    out = []
    for n in queries(s):
        x = (n * (n + 1)) & 0xFFFFFFFF
        x = x - (1 << 32) if x >= 1 << 31 else x
        out.append(str(x // 2 if x >= 0 else -(-x // 2)))
    return '\n'.join(out)


def wrong_off_by_one(s):
    return '\n'.join(str(n * (n - 1) // 2) for n in queries(s))


def fmt(qs):
    return f'{len(qs)}\n{" ".join(map(str, qs))}\n'


def cases(r):
    out = [fmt([3, 9]), fmt([1]), fmt([1000000000]), fmt([65535, 65536, 46340, 46341])]
    for t, hi in [(10, 100), (1000, 10**5), (8000, 10**9)]:
        out.append(fmt([r.randint(1, hi) for _ in range(t)]))
    return out
