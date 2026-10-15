from itertools import permutations

LEVEL = '中等'
TAGS = ['回溯', '字符串']
SAMPLES = 2
MAX_N = 9


def show(words):
    return '\n'.join([str(len(words))] + words)


def solve(s):
    return show(sorted({''.join(p) for p in permutations(s.strip())}))


def wrong_keeps_repeats(s):
    return show(sorted(''.join(p) for p in permutations(s.strip())))


def wrong_ignores_case(s):
    return show(sorted({''.join(p) for p in permutations(s.strip())}, key=lambda w: (w.lower(), w)))


def size(s):
    return len(s.split()[0])


def cases(r):
    out = ['xxy\n', 'BbB\n', 'z\n', 'aaaa\n', 'ab\n', 'aabb\n', 'bBaA\n', 'aaaaabbbb\n']
    for n, pool in [(5, 'abc'), (6, 'aAb'), (7, 'abcd'), (8, 'aabbcC'), (9, 'aaabbc')]:
        out.append(''.join(r.choice(pool) for _ in range(n)) + '\n')
    return out
