LEVEL = '简单'
TAGS = ['动态规划', '数学']
SAMPLES = 1
MAX_N = (1000, 100000)
MOD = 1000000007


def table(m, a, b, mod):
    f = [a, b]
    for _ in range(m):
        f.append((f[-1] + f[-2]) % mod if mod else f[-1] + f[-2])
    return f


def solve(s):
    a = list(map(int, s.split()))
    qs = a[1:a[0] + 1]
    f = table(max(qs) + 1, 0, 1, MOD)
    return '\n'.join(str(f[n]) for n in qs)


def wrong_starts_at_one(s):
    # Starts the sequence at F(0) = 1.
    a = list(map(int, s.split()))
    qs = a[1:a[0] + 1]
    f = table(max(qs) + 1, 1, 1, MOD)
    return '\n'.join(str(f[n]) for n in qs)


def wrong_no_mod_int64(s):
    # Adds in 64-bit integers without reducing, and reduces only at the end: F(93) overflows.
    a = list(map(int, s.split()))
    qs = a[1:a[0] + 1]
    f = [0, 1]
    for _ in range(max(qs)):
        x = (f[-1] + f[-2]) & 0xFFFFFFFFFFFFFFFF
        f.append(x - (1 << 64) if x >= 1 << 63 else x)
    # C++ % keeps the dividend's sign.
    return '\n'.join(str(abs(f[n]) % MOD * (1 if f[n] >= 0 else -1)) for n in qs)


def size(s):
    t, *rest = map(int, s.split())
    return t, max(rest)


def cases(r):
    out = ['4\n7 11 0 50\n', '1\n0\n', '1\n1\n', '3\n44 45 46\n', '5\n100 1000 10000 99999 100000\n']
    for t, hi in [(10, 50), (100, 1000), (1000, 100000)]:
        qs = [r.randint(0, hi) for _ in range(t)]
        out.append(f'{t}\n{" ".join(map(str, qs))}\n')
    return out
