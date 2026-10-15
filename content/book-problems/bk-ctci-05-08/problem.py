LEVEL = '中等'
TAGS = ['位运算', '数组']
SAMPLES = 2


def draw(s, low_bit_first=False, signed=True):
    length, w, x1, x2, y = map(int, s.split())
    screen = [0] * length
    for x in range(x1, x2 + 1):
        k = (y * w + x) // 32
        bit = x % 32 if low_bit_first else 31 - x % 32
        screen[k] |= 1 << bit
    if signed:
        screen = [v - (1 << 32) if v >= 1 << 31 else v for v in screen]
    return ' '.join(map(str, screen))


def solve(s):
    return draw(s)


def wrong_lowest_bit_first(s):
    return draw(s, low_bit_first=True)


def wrong_unsigned(s):
    # Prints the words as unsigned values.
    return draw(s, signed=False)


def cases(r):
    out = ['1 32 30 31 0\n', '3 96 0 1 0\n', '1 32 0 31 0\n', '3 96 2 94 0\n', '4 32 5 5 3\n', '2 64 31 32 0\n',
           '6 64 0 63 2\n']
    for length in (8, 100, 1000):
        for _ in range(2):
            w = 32 * r.choice([d for d in range(1, length + 1) if length % d == 0])
            x1 = r.randrange(w)
            x2 = r.randint(x1, w - 1)
            out.append(f'{length} {w} {x1} {x2} {r.randrange(length * 32 // w)}\n')
    return out
