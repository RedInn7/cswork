LEVEL = '简单'
TAGS = ['字符串']
SAMPLES = 2


def parse(s):
    lines = s.split('\n')
    return lines[0], int(lines[1])


def solve(s):
    t, k = parse(s)
    k %= len(t)
    return t[k:] + t[:k]


def wrong_right_rotation(s):
    t, k = parse(s)
    k %= len(t)
    return t[len(t) - k:] + t[:len(t) - k]


def wrong_no_modulo(s):
    # Slices with k as given: past the end that leaves the string unchanged.
    t, k = parse(s)
    return t[k:] + t[:k]


def cases(r):
    out = ['hello123\n3\n', 'abcde\n7\n', 'x\n0\n', 'x\n1000000000\n', 'ab\n1\n', 'mnopqrstuv\n6\n', 'abc\n3\n',
           'abc\n0\n']
    letters = 'abcdefghijklmnopqrstuvwxyzABC0123456789'
    for n in (10, 100, 10000):
        t = ''.join(r.choice(letters) for _ in range(n))
        for k in (r.randint(0, n - 1), r.randint(n, 10**9)):
            out.append(f'{t}\n{k}\n')
    return out
