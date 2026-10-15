LEVEL = '简单'
TAGS = ['位运算']
SAMPLES = 1
MAX_N = 10000


def longest(num, at_zeros_only=False, cap=True):
    x = num & 0xFFFFFFFF
    best = cur = prev = 0
    for i in range(32):
        if x >> i & 1:
            cur += 1
            if at_zeros_only:
                continue
        else:
            # A zero bridges the run before it and the run after it; two zeros in a row reset prev.
            prev, cur = cur, 0
        best = max(best, prev + cur + 1)
    return min(best, 32) if cap else best


def queries(s):
    a = list(map(int, s.split()))
    return a[1:a[0] + 1]


def solve(s):
    return '\n'.join(str(longest(x)) for x in queries(s))


def wrong_updates_at_zeros_only(s):
    # Records the best only when it meets a zero, so a run reaching bit 31 is never counted.
    return '\n'.join(str(longest(x, at_zeros_only=True)) for x in queries(s))


def wrong_no_cap(s):
    # Adds the flipped bit even when all 32 bits are already ones.
    return '\n'.join(str(longest(x, cap=False)) for x in queries(s))


def fmt(qs):
    return f'{len(qs)}\n{" ".join(map(str, qs))}\n'


def cases(r):
    out = [fmt([3567, 11, -1]), fmt([0, 1, -2, 2**31 - 1, -2**31, 0b1001, 0b11011, -3, 0b100110111, -1])]
    for t in (20, 1000, 10000):
        qs = []
        for _ in range(t):
            x = 0
            for i in range(32):
                if r.random() < 0.7:
                    x |= 1 << i
            if r.random() < 0.3:
                x &= ~(1 << r.randrange(32))
            qs.append(x - (1 << 32) if x >= 1 << 31 else x)
        out.append(fmt(qs))
    return out
