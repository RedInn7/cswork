from collections import Counter

LEVEL = '简单'
TAGS = ['哈希表', '字符串']
SAMPLES = 2


def solve(s):
    s = s.strip()
    count = Counter(s)
    return next((c for c in s if count[c] == 1), 'none')


def wrong_alphabet_order(s):
    # Scans the alphabet instead of the string.
    count = Counter(s.strip())
    return next((c for c in 'abcdefghijklmnopqrstuvwxyz' if count[c] == 1), 'none')


def wrong_only_looks_ahead(s):
    # Takes the first letter that does not occur again later.
    s = s.strip()
    return next((c for i, c in enumerate(s) if s.find(c, i + 1) == -1), 'none')


def cases(r):
    out = ['abaccdeff\n', 'ccbbaa\n', 'z\n', 'zz\n', 'aab\n', 'baa\n', 'abcabcd\n', 'dcbabcd\n', 'leetcode\n']
    for n, letters in [(20, 'abcde'), (1000, 'abcdefghijklmnopqrstuvwxyz'), (50000, 'abcdefghij')]:
        w = [r.choice(letters) for _ in range(n)]
        out.append(''.join(w) + '\n')
        w = w + w
        w.insert(r.randrange(len(w)), 'x')
        out.append(''.join(w)[:100000] + '\n')
    return out
