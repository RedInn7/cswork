from functools import lru_cache

LEVEL = '中等'
TAGS = ['动态规划', '记忆化搜索']
SAMPLES = 2
MAX_N = 39


def parse(s):
    lines = s.split('\n')
    return lines[0].strip(), int(lines[1])


def count(expr, want, xor_as_or=False):
    @lru_cache(maxsize=None)
    def go(i, j):
        """(ways to get 0, ways to get 1) for expr[i..j]."""
        if i == j:
            return (0, 1) if expr[i] == '1' else (1, 0)
        zero = one = 0
        for k in range(i + 1, j, 2):
            l0, l1 = go(i, k - 1)
            r0, r1 = go(k + 1, j)
            op = '|' if xor_as_or and expr[k] == '^' else expr[k]
            total = (l0 + l1) * (r0 + r1)
            if op == '&':
                t = l1 * r1
            elif op == '|':
                t = total - l0 * r0
            else:
                t = l1 * r0 + l0 * r1
            one += t
            zero += total - t
        return zero, one
    return go(0, len(expr) - 1)[want]


def solve(s):
    return str(count(*parse(s)))


def wrong_xor_as_or(s):
    expr, want = parse(s)
    return str(count(expr, want, xor_as_or=True))


def wrong_cache_without_result(s):
    # Memoises on (i, j) only, so a subexpression answers whichever value was asked first.
    expr, want = parse(s)
    memo = {}

    def go(i, j, w):
        if (i, j) in memo:
            return memo[i, j]
        if i == j:
            res = int((expr[i] == '1') == bool(w))
        else:
            res = 0
            for k in range(i + 1, j, 2):
                for a in (0, 1):
                    for b in (0, 1):
                        v = a & b if expr[k] == '&' else a | b if expr[k] == '|' else a ^ b
                        if v == w:
                            res += go(i, k - 1, a) * go(k + 1, j, b)
        memo[i, j] = res
        return res
    return str(go(0, len(expr) - 1, want))


def size(s):
    return len(s.split()[0])


def cases(r):
    out = ['0&1|0^1\n1\n', '0^1&1|0&1\n0\n', '1\n1\n', '1\n0\n', '0|1\n1\n', '1^1\n1\n', '1&1&1&1\n1\n']
    for n in (4, 7, 12, 18, 20, 20):
        expr = r.choice('01') + ''.join(r.choice('&|^') + r.choice('01') for _ in range(n - 1))
        for want in (0, 1):
            out.append(f'{expr}\n{want}\n')
    return out
