LEVEL = '中等'
TAGS = ['动态规划', '字符串']
SAMPLES = 2


def count(d, piece):
    a, b = 1, 1
    for i in range(1, len(d)):
        a, b = b, b + (a if piece(d[i - 1:i + 1]) else 0)
    return str(b)


def solve(s):
    return count(s.strip(), lambda p: p[0] != '0' and p <= '25')


def wrong_leading_zero_pairs(s):
    # Accepts 00–09 as two-digit pieces.
    return count(s.strip(), lambda p: p <= '25')


def wrong_twenty_six(s):
    # Lets 26 be a piece.
    return count(s.strip(), lambda p: p[0] != '0' and p <= '26')


def cases(r):
    out = ['12258\n', '506\n', '0\n', '25\n', '26\n', '10\n', '100\n', '1111111111\n', '2626\n', '0525\n',
           '1' * 60 + '\n', '25' * 30 + '\n', '1024\n', '9090909\n']
    for n in (5, 20, 40, 60, 60):
        out.append(''.join(r.choice('0122225678') for _ in range(n)) + '\n')
    return out
