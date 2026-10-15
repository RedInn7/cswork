LEVEL = '中等'
TAGS = ['字符串', '动态规划', '哈希表']
SAMPLES = 2
MAX_N = 200


def words_of(s):
    v = s.split()
    return v[1:1 + int(v[0])]


def built(w, words, allow_self=False):
    f = [True] + [False] * len(w)
    for i in range(1, len(w) + 1):
        for j in range(i):
            if f[j] and w[j:i] in words and (allow_self or (j, i) != (0, len(w))):
                f[i] = True
                break
    return f[-1]


def longest(s, allow_self=False, order=lambda w: (-len(w), w)):
    ws = words_of(s)
    words = set(ws)
    for w in sorted(ws, key=order):
        if built(w, words, allow_self):
            return w
    return 'none'


def solve(s):
    return longest(s)


def wrong_counts_itself(s):
    return longest(s, allow_self=True)


def wrong_largest_on_tie(s):
    return longest(s, order=lambda w: (-len(w), [-ord(c) for c in w]))


def fmt(ws):
    return f'{len(ws)}\n{" ".join(ws)}\n'


def cases(r):
    out = [fmt(['sun', 'flower', 'sunflower', 'rise', 'sunrise', 'seed', 'flowerseed', 'sunflowerseed', 'riser']), fmt(['ab', 'cd', 'abx']),
           fmt(['a']), fmt(['a', 'aa', 'aaa']), fmt(['ab', 'ba', 'abba', 'baab']), fmt(['x', 'y', 'xy', 'yx', 'xyz'])]
    for n, base in [(10, 3), (60, 8), (200, 20)]:
        parts = sorted({''.join(r.choice('abc') for _ in range(r.randint(1, 3))) for _ in range(base)})
        ws = set(parts)
        while len(ws) < n:
            ws.add(''.join(r.choice(parts) for _ in range(r.randint(1, 6)))[:100] + (r.choice('d') if r.random() < 0.3 else ''))
        out.append(fmt(r.sample(sorted(ws), len(ws))))
    return out
