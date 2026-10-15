LEVEL = '简单'
TAGS = ['数学']
SAMPLES = 2


def show(lengths):
    return f'{len(lengths)}\n' + ' '.join(map(str, lengths))


def lengths(s):
    a, b, k = map(int, s.split())
    return [a * (k - i) + b * i for i in range(k + 1)]


def solve(s):
    a, b, k = map(int, s.split())
    return show([] if k == 0 else sorted(set(lengths(s))))


def wrong_equal_planks_repeat(s):
    a, b, k = map(int, s.split())
    return show([] if k == 0 else lengths(s))


def wrong_zero_planks(s):
    # Returns the empty board of length 0 when k = 0.
    return show(sorted(set(lengths(s))))


def cases(r):
    return ['1 2 3\n', '4 4 5\n', '1 1 0\n', '2 99999 0\n', '7 7 100000\n', '1 100000 20000\n', '3 5 1\n',
            f'{r.randint(1, 100)} {r.randint(101, 1000)} {r.randint(1, 1000)}\n', '99999 100000 10000\n']
