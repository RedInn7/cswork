LEVEL = '简单'
TAGS = ['位运算']
SAMPLES = 1
MAX_N = 10000


def queries(s):
    a = list(map(int, s.split()))
    return a[1:a[0] + 1]


def solve(s):
    return '\n'.join(str(((x & 0xAAAAAAAA) >> 1) | ((x & 0x55555555) << 1)) for x in queries(s))


def wrong_masks_swapped(s):
    # Shifts the odd bits left and the even bits right.
    return '\n'.join(str(((x & 0xAAAAAAAA) << 1) | ((x & 0x55555555) >> 1)) for x in queries(s))


def wrong_no_masks(s):
    # Shifts the whole number both ways without masking.
    return '\n'.join(str(((x >> 1) | (x << 1)) & (2**31 - 1)) for x in queries(s))


def fmt(qs):
    return f'{len(qs)}\n{" ".join(map(str, qs))}\n'


def cases(r):
    out = [fmt([10, 6, 12]), fmt([0, 1, 2**30 - 1, 2**29, 0x15555555, 0x2AAAAAAA, 6, 9])]
    for t in (20, 1000, 10000):
        out.append(fmt([r.randrange(2**30) for _ in range(t)]))
    return out
