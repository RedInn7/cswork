from itertools import permutations

LEVEL = '中等'
TAGS = ['回溯', '字符串']
SAMPLES = 2


def solve(s):
    return '\n'.join(sorted(''.join(p) for p in permutations(s.strip())))


def wrong_swap_order(s):
    # The swap-based backtracking order, never sorted.
    w = list(s.strip())
    out = []

    def go(k):
        if k == len(w):
            out.append(''.join(w))
            return
        for i in range(k, len(w)):
            w[k], w[i] = w[i], w[k]
            go(k + 1)
            w[k], w[i] = w[i], w[k]
    go(0)
    return '\n'.join(out)


def wrong_ignores_case(s):
    return '\n'.join(sorted((''.join(p) for p in permutations(s.strip())), key=str.lower))


def cases(r):
    letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    out = ['abc\n', 'aB\n', 'q\n', 'ba\n', 'cab\n', 'Zz\n', 'abcd\n']
    for n in (5, 6, 7, 8):
        out.append(''.join(r.sample(letters, n)) + '\n')
    return out
