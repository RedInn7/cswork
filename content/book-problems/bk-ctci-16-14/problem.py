from math import gcd

LEVEL = '中等'
TAGS = ['几何', '哈希表', '数学']
SAMPLES = 2
MAX_N = 300


def points(s):
    v = list(map(int, s.split()))
    return [(v[1 + 2 * i], v[2 + 2 * i]) for i in range(v[0])]


def best(pts, key, keep_first=True):
    top = None  # (count, s0, s1)
    for i in range(len(pts)):
        groups = {}
        for j in range(i + 1, len(pts)):
            groups.setdefault(key(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]), []).append(j)
        for js in groups.values():
            cand = (len(js) + 1, i, js[0])
            if top is None or cand[0] > top[0] or (not keep_first and cand[0] == top[0]):
                top = cand
    return f'{top[1]} {top[2]}'


def direction(dx, dy):
    g = gcd(dx, dy)
    dx, dy = dx // g, dy // g
    return (dx, dy) if dx > 0 or (dx == 0 and dy > 0) else (-dx, -dy)


def solve(s):
    return best(points(s), direction)


def wrong_float_slope(s):
    return best(points(s), lambda dx, dy: dy / dx)


def wrong_last_tie(s):
    # Lets a later line with the same count replace the earlier one.
    return best(points(s), direction, keep_first=False)


def fmt(pts):
    return f'{len(pts)}\n' + ''.join(f'{x} {y}\n' for x, y in pts)


def cases(r):
    out = [fmt([(0, 0), (1, 1), (2, 2), (1, 0)]), fmt([(0, 0), (1, 2), (3, 1)]), fmt([(5, 5), (5, -5)]),
           fmt([(0, 1), (0, 5), (0, -3), (2, 2), (4, 3)]), fmt([(1, 1), (2, 2), (3, 4), (5, 7), (7, 10)])]
    for n, v in [(10, 3), (50, 5), (300, 20), (300, 10000)]:
        pts = set()
        while len(pts) < n:
            pts.add((r.randint(-v, v), r.randint(-v, v)))
        pts = list(pts)
        r.shuffle(pts)
        out.append(fmt(pts))
    pts = [(3 * k, 7) for k in range(-50, 50)] + [(k, k) for k in range(8, 100)]
    r.shuffle(pts)
    out.append(fmt(pts))
    return out
