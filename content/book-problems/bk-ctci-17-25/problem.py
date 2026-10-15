LEVEL = '困难'
TAGS = ['回溯', '字典树']
SAMPLES = 2
MAX_N = 200


def words_of(s):
    v = s.split()
    return v[1:1 + int(v[0])]


def fits(rows_pool, prefixes, full, length, height):
    """Is there a rectangle of `height` rows taken from rows_pool (words of `length`)?"""
    cols = [''] * length

    def go(depth):
        if depth == height:
            return all(c in full for c in cols)
        for w in rows_pool:
            nxt = [cols[k] + w[k] for k in range(length)]
            if all(c in prefixes for c in nxt):
                saved = cols[:]
                cols[:] = nxt
                if go(depth + 1):
                    return True
                cols[:] = saved
        return False
    return go(0)


def largest(s, squares_only=False, any_length_prefix=False):
    ws = words_of(s)
    by_len = {}
    for w in ws:
        by_len.setdefault(len(w), []).append(w)
    shapes = sorted(((l * h, l, h) for l in by_len for h in by_len if not squares_only or l == h), reverse=True)
    for area, length, height in shapes:
        pool = [w for w in ws if len(w) == height or any_length_prefix]
        prefixes = {w[:k] for w in pool for k in range(1, height + 1)}
        full = {w for w in ws if len(w) == height} if not any_length_prefix else prefixes
        if fits(sorted(by_len[length]), prefixes, full, length, height):
            return str(area)
    return '0'


def solve(s):
    return largest(s)


def wrong_squares_only(s):
    return largest(s, squares_only=True)


def wrong_column_prefixes(s):
    # Accepts a finished column that is only the start of some longer word.
    return largest(s, any_length_prefix=True)


def fmt(ws):
    return f'{len(ws)}\n{" ".join(ws)}\n'


def plant(r, height, length, letters):
    grid = [''.join(r.choice(letters) for _ in range(length)) for _ in range(height)]
    return grid + [''.join(row[k] for row in grid) for k in range(length)]


def cases(r):
    out = [fmt(['cat', 'are', 'ten', 'rat', 'ant', 'net', 'tar', 'ear']), fmt(['ab', 'cd']), fmt(['a']), fmt(['ab', 'a', 'b']),
           fmt(['ab', 'cd', 'ac', 'bd', 'abc']), fmt(['xyz', 'xy', 'yz', 'x', 'y', 'z']), fmt(['abcd', 'ab', 'cd', 'ac', 'bd'])]
    letters = 'abcdefghijklmnop'
    for n, shape in [(30, (2, 3)), (80, (3, 4)), (150, (4, 5)), (200, (2, 6)), (200, None)]:
        ws = set(plant(r, *shape, letters)) if shape else set()
        while len(ws) < n:
            ws.add(''.join(r.choice(letters) for _ in range(r.randint(1, 6))))
        out.append(fmt(r.sample(sorted(ws), len(ws))))
    return out
