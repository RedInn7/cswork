LEVEL = '中等'
TAGS = ['数学', '位运算']
SAMPLES = 1
MAX_N = 10000


def exprs(s):
    lines = s.split('\n')
    return [line.split() for line in lines[1:int(lines[0]) + 1]]


def evaluate(s, floor=False, sign_of_a=False):
    out = []
    for a, op, b in exprs(s):
        a, b = int(a), int(b)
        if op == '-':
            out.append(a - b)
        elif op == '*':
            out.append(abs(a * b) * (-1 if a < 0 else 1) if sign_of_a else a * b)
        else:
            q = abs(a) // abs(b)
            out.append(a // b if floor else (q if (a < 0) == (b < 0) else -q))
    return '\n'.join(map(str, out))


def solve(s):
    return evaluate(s)


def wrong_floor_division(s):
    return evaluate(s, floor=True)


def wrong_product_sign(s):
    # Takes the product's sign from a alone.
    return evaluate(s, sign_of_a=True)


def fmt(items):
    return f'{len(items)}\n' + ''.join(f'{a} {op} {b}\n' for a, op, b in items)


def cases(r):
    out = [fmt([(-7, '/', 2), (6, '*', -4), (5, '-', -3)]),
           fmt([(7, '/', -2), (-7, '/', -2), (0, '/', 5), (10**9, '*', 10**9), (-10**9, '*', -10**9), (1, '-', 10**9),
                (9, '/', 3), (-9, '/', 3), (0, '*', -8), (-1, '/', 10**9)])]
    for t, v in [(30, 20), (1000, 10**4), (10000, 10**9)]:
        items = []
        for _ in range(t):
            op = r.choice('-*/')
            b = r.randint(-v, v)
            if op == '/' and b == 0:
                b = 1
            items.append((r.randint(-v, v), op, b))
        out.append(fmt(items))
    return out
