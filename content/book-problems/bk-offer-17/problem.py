LEVEL = '简单'
TAGS = ['数学', '字符串']
SAMPLES = 2
MAX_N = 5


def solve(s):
    n = int(s)
    return ' '.join(map(str, range(1, 10 ** n)))


def wrong_inclusive_bound(s):
    # Goes up to 10^n itself.
    n = int(s)
    return ' '.join(map(str, range(1, 10 ** n + 1)))


def wrong_starts_at_zero(s):
    # Prints every digit string including the all-zero one.
    n = int(s)
    return ' '.join(map(str, range(0, 10 ** n)))


def cases(r):
    return ['1\n', '2\n', '3\n', '4\n', '5\n']
