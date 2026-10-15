from fractions import Fraction

LEVEL = '中等'
TAGS = ['几何', '数学']
SAMPLES = 2
CHECKER = 'float-array'


def squares(s):
    v = list(map(int, s.split()))
    return [(v[0], v[1], v[2]), (v[3], v[4], v[5])]


def hits(sq, dx, dy, steep_ok=True):
    """Where the line through the square's centre with direction (dx, dy) meets its boundary."""
    x, y, size = sq
    cx, cy, h = Fraction(2 * x + size, 2), Fraction(2 * y + size, 2), Fraction(size, 2)
    if steep_ok and abs(dy) > abs(dx):
        step = h / abs(dy)
    else:
        step = h / abs(dx)
    return [(cx - dx * step, cy - dy * step), (cx + dx * step, cy + dy * step)]


def solve_with(s, steep_ok=True, order=lambda p: p):
    a, b = squares(s)
    dx = Fraction(2 * b[0] + b[2] - 2 * a[0] - a[2], 2)
    dy = Fraction(2 * b[1] + b[2] - 2 * a[1] - a[2], 2)
    if dx == dy == 0:
        dx, dy = Fraction(0), Fraction(1)
    pts = hits(a, dx, dy, steep_ok) + hits(b, dx, dy, steep_ok)
    pts.sort(key=lambda p: p[0] * dx + p[1] * dy)
    ends = sorted([pts[0], pts[-1]], key=order)
    return '4 ' + ' '.join(f'{float(v):.10f}' for p in ends for v in p)


def solve(s):
    return solve_with(s)


def wrong_left_right_sides_only(s):
    # Always meets the left and right sides; steep lines overshoot and vertical ones divide by zero.
    return solve_with(s, steep_ok=False)


def wrong_order_by_y(s):
    return solve_with(s, order=lambda p: (p[1], p[0]))


def fmt(a, b):
    return f'{a[0]} {a[1]} {a[2]}\n{b[0]} {b[1]} {b[2]}\n'


def cases(r):
    out = [fmt((1, 1, 2), (4, 1, 2)), fmt((3, 3, 4), (4, 4, 2)), fmt((0, 0, 4), (10, 1, 2)), fmt((0, 0, 2), (1, 9, 2)),
           fmt((0, 0, 2), (5, -5, 2)), fmt((-3, 4, 6), (-3, -8, 2)), fmt((0, 0, 10), (4, 4, 2)), fmt((2, 2, 1), (0, 0, 5)),
           fmt((-1000, -1000, 1000), (1000, 1000, 1))]
    for _ in range(8):
        out.append(fmt((r.randint(-1000, 1000), r.randint(-1000, 1000), r.randint(1, 1000)),
                       (r.randint(-1000, 1000), r.randint(-1000, 1000), r.randint(1, 1000))))
    return out
