LEVEL = '简单'
TAGS = ['动态规划']
SAMPLES = 1
MOD = 1000000007


def table(top, start, steps=3):
    f = list(start)
    while len(f) <= top:
        f.append(sum(f[-steps:]) % MOD)
    return f


def queries(s):
    a = list(map(int, s.split()))
    return a[1:a[0] + 1]


def answer(s, start, steps=3):
    qs = queries(s)
    f = table(max(qs), start, steps)
    return '\n'.join(str(f[n]) for n in qs)


def solve(s):
    return answer(s, [1, 1, 2])


def wrong_two_steps_only(s):
    return answer(s, [1, 1], steps=2)


def wrong_floor_is_zero(s):
    # Starts from f(0) = 0, so every count after step 2 comes out short.
    return answer(s, [0, 1, 2])


def fmt(qs):
    return f'{len(qs)}\n{" ".join(map(str, qs))}\n'


def cases(r):
    out = [fmt([4, 6, 1, 2]), fmt([1]), fmt([2]), fmt([4, 10, 30, 36, 37]), fmt([1000000])]
    for t, hi in [(10, 50), (1000, 10**5), (1000, 10**6)]:
        out.append(fmt([r.randint(1, hi) for _ in range(t)]))
    return out
