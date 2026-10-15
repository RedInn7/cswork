LEVEL = '中等'
TAGS = ['动态规划', '数学']
SAMPLES = 2
MOD = 1000000007


def ways(n):
    """Closed form per number of quarters: with m cents left and D = m // 10,
    the dimes d = 0..D each leave (m - 10d) // 5 + 1 nickel/penny splits."""
    total = 0
    for q in range(n // 25 + 1):
        m = n - 25 * q
        d = m // 10
        total += (d + 1) * (m // 5 + 1) - d * (d + 1)
    return total


def solve(s):
    return str(ways(int(s)) % MOD)


def wrong_no_modulo(s):
    return str(ways(int(s)))


def wrong_ordered(s):
    # Amounts outside, coins inside: counts every order of the same coins.
    n = int(s)
    dp = [1] + [0] * n
    for j in range(1, n + 1):
        dp[j] = (dp[j - 1] + (dp[j - 5] if j >= 5 else 0) + (dp[j - 10] if j >= 10 else 0)
                 + (dp[j - 25] if j >= 25 else 0)) % MOD
    return str(dp[n])


def cases(r):
    return [f'{n}\n' for n in [5, 10, 0, 1, 4, 25, 26, 100, 1000, 30000, 1000000, r.randint(10**5, 10**6)]]
