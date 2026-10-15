LEVEL = '困难'
TAGS = ['数学', '数位统计']
SAMPLES = 1


def twos(n, d=2):
    total, base = 0, 1
    while base <= n:
        high, cur, low = n // (base * 10), n // base % 10, n % base
        if cur < d:
            total += high * base
        elif cur == d:
            total += high * base + low + 1
        else:
            total += (high + 1) * base
        base *= 10
    return total


def queries(s):
    v = list(map(int, s.split()))
    return v[1:v[0] + 1]


def solve(s):
    return '\n'.join(str(twos(n)) for n in queries(s))


def wrong_ones_formula(s):
    # The count-the-ones formula reused as is: it compares the digit with 1.
    return '\n'.join(str(twos(n, d=1)) for n in queries(s))


def wrong_excludes_n(s):
    return '\n'.join(str(twos(n - 1) if n else 0) for n in queries(s))


def fmt(qs):
    return f'{len(qs)}\n{" ".join(map(str, qs))}\n'


def cases(r):
    out = [fmt([25]), fmt([0, 1, 2, 9, 10, 12, 20, 22, 99, 100, 222, 1000, 10**9, 2222222])]
    for t, hi in [(20, 1000), (1000, 10**6), (10000, 10**9)]:
        out.append(fmt([r.randint(0, hi) for _ in range(t)]))
    return out
