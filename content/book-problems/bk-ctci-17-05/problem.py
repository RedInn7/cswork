LEVEL = '中等'
TAGS = ['哈希表', '前缀和']
SAMPLES = 2
MAX_N = 100000


def longest(t, keep_first=True, rightmost=False):
    seen, total = {0: 0}, 0
    best = (0, 0)
    for i, c in enumerate(t, 1):
        total += 1 if c.isalpha() else -1
        if total in seen:
            length = i - seen[total]
            if length > best[1] - best[0] or (rightmost and length == best[1] - best[0] and length):
                best = (seen[total], i)
        if keep_first:
            seen.setdefault(total, i)
        else:
            seen[total] = i
    return t[best[0]:best[1]] or 'none'


def solve(s):
    return longest(s.strip())


def wrong_rightmost(s):
    return longest(s.strip(), rightmost=True)


def wrong_last_position(s):
    # Overwrites each prefix sum's position, so it measures from the latest one.
    return longest(s.strip(), keep_first=False)


def size(s):
    return len(s.split()[0])


def cases(r):
    out = ['A1B2C3D4E\n', 'ABCD\n', '1\n', 'a1\n', '1a1a\n', 'aa11a1\n', 'abc123abc\n', '9aZ8\n', 'aaaa1111aa1\n']
    for n, p in [(20, 0.5), (500, 0.6), (5000, 0.5), (100000, 0.52), (50000, 0.7)]:
        out.append(''.join(r.choice('abcXYZ') if r.random() < p else r.choice('0123456789') for _ in range(n)) + '\n')
    return out
