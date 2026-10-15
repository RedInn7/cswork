from itertools import permutations

LEVEL = '中等'
TAGS = ['回溯', '字符串']
SAMPLES = 2


def solve(s):
    return '\n'.join(sorted({''.join(p) for p in permutations(s.strip())}))


def wrong_keeps_repeats(s):
    # Swaps every pair without skipping equal letters, so repeats are printed again.
    return '\n'.join(sorted(''.join(p) for p in permutations(s.strip())))


def wrong_input_order(s):
    # Removes repeats but lists them in the order the backtracking finds them.
    seen, out = set(), []
    for p in permutations(s.strip()):
        w = ''.join(p)
        if w not in seen:
            seen.add(w)
            out.append(w)
    return '\n'.join(out)


def cases(r):
    out = ['abc\n', 'aab\n', 'z\n', 'zz\n', 'ba\n', 'aaaaaaaa\n', 'cbaa\n', 'aabbccdd\n', 'dcbahgfe\n']
    for n in (3, 5, 6, 7, 8):
        out.append(''.join(r.choice('abcd'[:max(2, n // 2)]) for _ in range(n)) + '\n')
    return out
