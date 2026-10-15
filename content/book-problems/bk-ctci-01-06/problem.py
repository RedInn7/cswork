from itertools import groupby

LEVEL = '简单'
TAGS = ['字符串', '双指针']
SAMPLES = 2


def compress(t):
    return ''.join(f'{c}{len(list(g))}' for c, g in groupby(t))


def solve(s):
    t = s.strip()
    c = compress(t)
    return c if len(c) < len(t) else t


def wrong_always_compressed(s):
    return compress(s.strip())


def wrong_not_longer(s):
    # Keeps the compressed form when it ties with the original.
    t = s.strip()
    c = compress(t)
    return c if len(c) <= len(t) else t


def cases(r):
    out = ['xxxyzzzzzz\n', 'aabcdd\n', 'a\n', 'aa\n', 'aaa\n', 'aabb\n', 'aAaA\n', 'aaaaaaaaaaaab\n', 'abbbbbbbbbbbbbbbbbbbc\n',
           'aaabbb\n', 'aabbcc\n']
    for n in (30, 1000, 50000):
        w = []
        while len(w) < n:
            w += [r.choice('abAB')] * r.randint(1, 12)
        out.append(''.join(w[:n]) + '\n')
    out.append(''.join(r.choice('abcdefABCDEF') for _ in range(50000)) + '\n')
    return out
