LEVEL = '中等'
TAGS = ['动态规划', '字典树', '字符串']
SAMPLES = 2


def parse(s):
    lines = s.split('\n')
    return set(lines[1].split()), lines[2].strip()


def solve(s):
    words, t = parse(s)
    lengths = sorted({len(w) for w in words})
    f = [0] * (len(t) + 1)
    for i in range(1, len(t) + 1):
        f[i] = f[i - 1] + 1
        for k in lengths:
            if k > i:
                break
            if t[i - k:i] in words:
                f[i] = min(f[i], f[i - k])
    return str(f[-1])


def greedy(s, longest):
    words, t = parse(s)
    lengths = sorted({len(w) for w in words}, reverse=longest)
    i = miss = 0
    while i < len(t):
        for k in lengths:
            if t[i:i + k] in words:
                i += k
                break
        else:
            i += 1
            miss += 1
    return str(miss)


def wrong_greedy_longest(s):
    return greedy(s, True)


def wrong_greedy_shortest(s):
    return greedy(s, False)


def fmt(words, t):
    return f'{len(words)}\n{" ".join(words)}\n{t}\n'


def cases(r):
    out = [fmt(['the', 'cat', 'sat', 'on', 'mat', 'at'], 'thecatsatonthemat'), fmt(['fox', 'quick'], 'brownfox'),
           fmt(['a'], 'b'), fmt(['ab', 'abc', 'cd'], 'abcd'), fmt(['a', 'aab'], 'aab'), fmt(['abcd', 'ab', 'cde'], 'abcde'),
           fmt(['x' * 100], 'x' * 1000)]
    for n, sentence in [(10, 50), (60, 400), (150, 1000)]:
        words = sorted({''.join(r.choice('abc') for _ in range(r.randint(1, 5))) for _ in range(n)})
        t = ''
        while len(t) < sentence:
            t += r.choice(words) if r.random() < 0.8 else r.choice('abcd')
        out.append(fmt(words, t[:sentence]))
    return out
