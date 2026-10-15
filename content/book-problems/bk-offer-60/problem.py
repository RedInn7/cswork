LEVEL = '中等'
TAGS = ['动态规划', '概率']
SAMPLES = 2
MAX_N = 11
CHECKER = 'float-array'


def ways(n):
    f = [1]  # f[s]: ways for total s + (number of dice so far)
    for _ in range(n):
        g = [0] * (len(f) + 5)
        for s, w in enumerate(f):
            for face in range(6):
                g[s + face] += w
        f = g
    return f


def show(values):
    return ' '.join([str(len(values))] + values)


def solve(s):
    n = int(s)
    return show([f'{w / 6 ** n:.10f}' for w in ways(n)])


def wrong_counts(s):
    # Prints the number of ways and forgets to divide by 6^n.
    return show([str(w) for w in ways(int(s))])


def wrong_from_zero(s):
    # Prints every total from 0 to 6n, impossible ones included.
    n = int(s)
    return show(['0'] * n + [f'{w / 6 ** n:.10f}' for w in ways(n)])


def cases(r):
    return [f'{n}\n' for n in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]]
