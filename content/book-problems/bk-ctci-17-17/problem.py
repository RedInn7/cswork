LEVEL = '中等'
TAGS = ['字典树', '字符串']
SAMPLES = 1
MAX_N = (1000, 1000, 100000)


def parse(s):
    lines = s.split('\n')
    return lines[0].strip(), lines[2].split()


def show(found):
    return '\n'.join(' '.join(map(str, [len(ps)] + ps)) for ps in found)


def solve(s):
    big, smalls = parse(s)
    return show([[i for i in range(len(big)) if big.startswith(w, i)] for w in smalls])


def wrong_no_overlap(s):
    big, smalls = parse(s)
    found = []
    for w in smalls:
        ps, i = [], big.find(w)
        while i != -1:
            ps.append(i)
            i = big.find(w, i + len(w))
        found.append(ps)
    return show(found)


def wrong_first_only(s):
    big, smalls = parse(s)
    return show([[big.find(w)] if w in big else [] for w in smalls])


def fmt(big, smalls):
    return f'{big}\n{len(smalls)}\n{" ".join(smalls)}\n'


def size(s):
    v = s.split()
    return len(v[0]), int(v[1]), sum(map(len, v[2:]))


def cases(r):
    out = [fmt('abracadabra', ['abra', 'a', 'cad', 'x', 'bra']), fmt('aaaa', ['aa', 'a', 'aaaa', 'aaaaa']), fmt('z', ['z']),
           fmt('ababab', ['abab', 'bab', 'ba'])]
    for n, m, letters, shortest in [(30, 10, 'ab', 1), (300, 100, 'abc', 1), (1000, 1000, 'ab', 6),
                                    (1000, 200, 'abcdefghijklmnopqrstuvwxyz', 1)]:
        big = ''.join(r.choice(letters) for _ in range(n))
        smalls = []
        for _ in range(m):
            if r.random() < 0.7:
                i = r.randrange(n)
                smalls.append(big[i:i + r.randint(shortest, shortest + 5)])
            else:
                smalls.append(''.join(r.choice(letters) for _ in range(r.randint(1, 8))))
        out.append(fmt(big, smalls))
    # Total length at its largest: 1000 short strings of 100 letters.
    big = ''.join(r.choice('ab') for _ in range(1000))
    smalls = [big[i:i + 100] if r.random() < 0.7 else ''.join(r.choice('ab') for _ in range(100))
              for i in (r.randrange(901) for _ in range(1000))]
    out.append(fmt(big, smalls))
    return out
