from fractions import Fraction

LEVEL = '困难'
TAGS = ['几何', '数学']
SAMPLES = 2
CHECKER = 'float-array'


def cross(ax, ay, bx, by):
    return ax * by - ay * bx


def meet(p1, p2, p3, p4, segment=True, collinear=True):
    rx, ry = p2[0] - p1[0], p2[1] - p1[1]
    sx, sy = p4[0] - p3[0], p4[1] - p3[1]
    qx, qy = p3[0] - p1[0], p3[1] - p1[1]
    d = cross(rx, ry, sx, sy)
    if d:
        t = Fraction(cross(qx, qy, sx, sy), d)
        u = Fraction(cross(qx, qy, rx, ry), d)
        if not segment or (0 <= t <= 1 and 0 <= u <= 1):
            return [p1[0] + t * rx, p1[1] + t * ry]
        return None
    if cross(qx, qy, rx, ry) or not collinear:
        return None

    def on(p, a, b):
        return min(a[0], b[0]) <= p[0] <= max(a[0], b[0]) and min(a[1], b[1]) <= p[1] <= max(a[1], b[1])
    shared = [p for p in (p1, p2, p3, p4) if on(p, p1, p2) and on(p, p3, p4)]
    return list(min(shared)) if shared else None


def parse(s):
    a = list(map(int, s.split()))
    return (a[0], a[1]), (a[2], a[3]), (a[4], a[5]), (a[6], a[7])


def show(point):
    return '0' if point is None else '2 ' + ' '.join(f'{float(v):.10f}' for v in point)


def solve(s):
    return show(meet(*parse(s)))


def wrong_infinite_lines(s):
    # Intersects the lines through the segments.
    return show(meet(*parse(s), segment=False))


def wrong_parallel_means_apart(s):
    # Treats every pair of parallel segments as disjoint, overlapping ones included.
    return show(meet(*parse(s), collinear=False))


def fmt(a, b, c, d):
    return f'{a[0]} {a[1]} {b[0]} {b[1]}\n{c[0]} {c[1]} {d[0]} {d[1]}\n'


def cases(r):
    out = [fmt((0, 0), (4, 2), (0, 3), (3, 0)), fmt((1, 2), (5, 2), (3, 2), (8, 2)), fmt((0, 0), (1, 1), (2, 2), (3, 3)),
           fmt((0, 0), (1, 0), (0, 1), (1, 1)), fmt((0, 0), (4, 4), (4, 0), (0, 4)), fmt((0, 0), (1, 1), (1, 1), (5, -3)),
           fmt((0, 0), (1, 0), (2, 1), (3, -1)), fmt((0, 5), (0, -5), (0, 3), (0, 9)), fmt((3, 3), (1, 1), (2, 2), (-4, -4)),
           fmt((-10**6, -10**6), (10**6, 10**6), (-10**6, 10**6), (10**6, -10**6)), fmt((1, 2), (7, 3), (2, 9), (5, -4))]
    for v in (5, 50, 10**6):
        for _ in range(4):
            pts = []
            while len(pts) < 4 or pts[0] == pts[1] or pts[2] == pts[3]:
                pts = [(r.randint(-v, v), r.randint(-v, v)) for _ in range(4)]
            out.append(fmt(*pts))
    return out
