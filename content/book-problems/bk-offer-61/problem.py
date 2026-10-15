LEVEL = '简单'
TAGS = ['排序', '哈希表']
SAMPLES = 1
MAX_N = 10000


def hands(s):
    a = list(map(int, s.split()))
    return [a[1 + 5 * i:6 + 5 * i] for i in range(a[0])]


def straight(h, check_repeats=True, skip_jokers=True):
    cards = [c for c in h if c] if skip_jokers else h
    if check_repeats and len(set(cards)) < len(cards):
        return False
    return not cards or max(cards) - min(cards) < 5


def answer(s, **kw):
    return '\n'.join('true' if straight(h, **kw) else 'false' for h in hands(s))


def solve(s):
    return answer(s)


def wrong_no_repeat_check(s):
    return answer(s, check_repeats=False)


def wrong_joker_in_min(s):
    return answer(s, skip_jokers=False)


def fmt(hs):
    return f'{len(hs)}\n' + ''.join(' '.join(map(str, h)) + '\n' for h in hs)


def cases(r):
    out = [fmt([[9, 10, 11, 12, 13], [0, 3, 0, 6, 7], [4, 5, 5, 6, 7], [0, 2, 3, 4, 8]]),
           fmt([[0, 0, 9, 13, 11], [10, 11, 12, 13, 1], [13, 12, 11, 10, 9], [0, 0, 13, 13, 12],
                [0, 9, 10, 11, 12], [0, 0, 8, 9, 10], [5, 4, 3, 2, 0]])]
    for t in (20, 200, 10000):
        hs = []
        for _ in range(t):
            if r.random() < 0.5:
                lo = r.randint(1, 9)
                h = list(range(lo, lo + 5))
                for i in r.sample(range(5), r.randint(0, 2)):
                    h[i] = 0
                if r.random() < 0.3:
                    h[r.randrange(5)] = r.randint(1, 13)
                r.shuffle(h)
            else:
                h = [r.randint(0, 13) for _ in range(5)]
                while h.count(0) > 2:
                    h[h.index(0)] = r.randint(1, 13)
            hs.append(h)
        out.append(fmt(hs))
    return out
