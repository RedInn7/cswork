LEVEL = '简单'
TAGS = ['二分查找', '字符串']
SAMPLES = 2
MAX_N = 20000


def parse(s):
    lines = s.split('\n')
    return lines[1].split(), lines[2].strip()


def solve(s):
    words, w = parse(s)
    return str(words.index(w) if w in words else -1)


def wrong_gap_goes_left(s):
    # On a gap, gives up the right half and searches only to the left.
    words, w = parse(s)
    lo, hi = 0, len(words) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if words[mid] == '#':
            hi = mid - 1
        elif words[mid] == w:
            return str(mid)
        elif words[mid] < w:
            lo = mid + 1
        else:
            hi = mid - 1
    return '-1'


def wrong_rank_among_words(s):
    # Removes the gaps first and reports the rank among the words.
    words, w = parse(s)
    real = [x for x in words if x != '#']
    return str(real.index(w) if w in real else -1)


def fmt(words, w):
    return f'{len(words)}\n{" ".join(words)}\n{w}\n'


def word(r, n):
    return ''.join(r.choice('abcdefghijklmnopqrstuvwxyz') for _ in range(n))


def cases(r):
    out = [fmt(['#', 'ant', '#', '#', 'bee', '#', 'cow', '#', '#', '#', 'yak', '#'], 'cow'),
           fmt(['#', 'ant', '#', '#', 'bee', '#', 'cow', '#', '#', '#', 'yak', '#'], 'dog'),
           fmt(['a'], 'a'), fmt(['#'], 'a'), fmt(['#', '#', 'x'], 'x'), fmt(['b', '#', '#', '#'], 'b'),
           fmt(['a', '#', '#', '#', '#', '#', 'z'], 'z')]
    for n, gap in [(20, 0.5), (300, 0.8), (5000, 0.3), (20000, 0.9)]:
        real = sorted({word(r, r.randint(1, 6)) for _ in range(int(n * (1 - gap)) + 1)})
        words = real[:]
        for _ in range(n - len(real)):
            words.insert(r.randint(0, len(words)), '#')
        for target in (r.choice(real), word(r, 3)):
            out.append(fmt(words, target))
    return out
