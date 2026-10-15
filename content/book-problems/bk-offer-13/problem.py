LEVEL = '中等'
TAGS = ['广度优先搜索', '矩阵']
SAMPLES = 2


def digits(x):
    return sum(map(int, str(x)))


def reach(m, n, k, ds):
    seen = [[False] * n for _ in range(m)]
    seen[0][0] = True
    stack, total = [(0, 0)], 0
    while stack:
        i, j = stack.pop()
        total += 1
        for a, b in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
            if 0 <= a < m and 0 <= b < n and not seen[a][b] and ds(a) + ds(b) <= k:
                seen[a][b] = True
                stack.append((a, b))
    return total


def solve(s):
    m, n, k = map(int, s.split())
    return str(reach(m, n, k, digits))


def wrong_count_allowed(s):
    # Counts every allowed cell, reachable or not.
    m, n, k = map(int, s.split())
    return str(sum(digits(i) + digits(j) <= k for i in range(m) for j in range(n)))


def wrong_two_digits(s):
    # Sums only the last two digits: i // 10 + i % 10 is wrong from 100 on.
    m, n, k = map(int, s.split())
    return str(reach(m, n, k, lambda x: x // 10 + x % 10))


def cases(r):
    out = ['2 3 1\n', '3 1 0\n', '1 1 0\n', '16 8 4\n', '40 40 8\n', '100 100 9\n', '300 300 10\n', '300 300 40\n',
           '120 50 3\n', '150 300 18\n']
    for _ in range(4):
        out.append(f'{r.randint(1, 300)} {r.randint(1, 300)} {r.randint(0, 25)}\n')
    return out
