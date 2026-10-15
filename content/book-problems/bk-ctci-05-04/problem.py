LEVEL = '中等'
TAGS = ['位运算']
SAMPLES = 1
MAX_N = 10000
TOP = 2**31 - 1


def bigger(x):
    low = x & -x
    ripple = x + low
    ones = ((x ^ ripple) >> 2) // low
    return ripple | ones


def neighbours(x, bound=True):
    b = bigger(x)
    if bound and b > TOP:
        b = -1
    # Complementing the 31 bits reverses the order and keeps the count of ones in step,
    # so the next smaller number is the complement of the complement's next larger one.
    c = TOP ^ x
    s = TOP ^ bigger(c) if c and bigger(c) <= TOP else -1
    return f'{b} {s}'


def queries(s):
    a = list(map(int, s.split()))
    return a[1:a[0] + 1]


def solve(s):
    return '\n'.join(neighbours(x) for x in queries(s))


def wrong_unbounded(s):
    # Lets the larger neighbour use bit 31, past the range.
    return '\n'.join(neighbours(x, bound=False) for x in queries(s))


def wrong_shift_lowest_one(s):
    # Moves the lowest one bit up or down by one place, which is wrong when ones sit together.
    out = []
    for x in queries(s):
        low = x & -x
        up = x + low if not x & (low << 1) else -1
        down = x - (low >> 1) if low > 1 else -1
        out.append(f'{up if 0 < up <= TOP else -1} {down}')
    return '\n'.join(out)


def fmt(qs):
    return f'{len(qs)}\n{" ".join(map(str, qs))}\n'


def cases(r):
    out = [fmt([6, 4, TOP]), fmt([3, 5, 6, 7, 2**30, 2**30 + 1, TOP - 1, 0b1011, 0b10011, 0b110, 0b1000, 0b111000])]
    for t in (20, 1000, 10000):
        out.append(fmt([r.randint(1, TOP) if k % 2 else r.randint(1, 2**12) for k in range(t)]))
    return out
