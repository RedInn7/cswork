LEVEL = '中等'
TAGS = ['差分数组', '数组']
SAMPLES = 2
MAX_N = 20000


def best_year(s, inclusive=True, latest=False):
    v = list(map(int, s.split()))
    delta = [0] * 103
    for k in range(v[0]):
        birth, death = v[1 + 2 * k], v[2 + 2 * k]
        delta[birth - 1900] += 1
        delta[death - 1900 + (1 if inclusive else 0)] -= 1
    alive = best = 0
    year = 1900
    for i in range(101):
        alive += delta[i]
        if alive > best or (latest and alive == best):
            best, year = alive, 1900 + i
    return str(year)


def solve(s):
    return best_year(s)


def wrong_death_year_excluded(s):
    return best_year(s, inclusive=False)


def wrong_latest_tie(s):
    return best_year(s, latest=True)


def fmt(ps):
    return f'{len(ps)}\n' + ''.join(f'{b} {d}\n' for b, d in ps)


def cases(r):
    out = [fmt([(1900, 1999), (1950, 1961), (1960, 1983)]), fmt([(1900, 1910), (1910, 1920)]), fmt([(2000, 2000)]),
           fmt([(1900, 1900), (1901, 1901)]), fmt([(1950, 1950), (1950, 1951), (1951, 1952)])]
    for n in (10, 1000, 20000):
        ps = []
        for _ in range(n):
            b = r.randint(1900, 2000)
            ps.append((b, r.randint(b, min(2000, b + r.randint(0, 60)))))
        out.append(fmt(ps))
    return out
