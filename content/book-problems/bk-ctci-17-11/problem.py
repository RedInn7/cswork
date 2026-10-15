LEVEL = '中等'
TAGS = ['双指针', '哈希表', '字符串']
SAMPLES = 1


def parse(s):
    v = s.split()
    n = int(v[0])
    words = v[1:1 + n]
    q = int(v[1 + n])
    return words, [(v[2 + n + 2 * k], v[3 + n + 2 * k]) for k in range(q)]


def positions(words):
    at = {}
    for i, w in enumerate(words):
        at.setdefault(w, []).append(i)
    return at


def closest(a, b, one_way=False):
    i = j = 0
    best = None
    while i < len(a) and j < len(b):
        if not one_way or a[i] < b[j]:
            d = abs(a[i] - b[j])
            best = d if best is None else min(best, d)
        if a[i] < b[j]:
            i += 1
        else:
            j += 1
    return best if best is not None else -1


def solve(s):
    words, qs = parse(s)
    at = positions(words)
    return '\n'.join(str(closest(at[x], at[y])) for x, y in qs)


def wrong_first_occurrences(s):
    words, qs = parse(s)
    return '\n'.join(str(abs(words.index(x) - words.index(y))) for x, y in qs)


def wrong_one_direction(s):
    # Only counts the first word appearing before the second.
    words, qs = parse(s)
    at = positions(words)
    return '\n'.join(str(closest(at[x], at[y], one_way=True)) for x, y in qs)


def fmt(words, qs):
    return f'{len(words)}\n{" ".join(words)}\n{len(qs)}\n' + ''.join(f'{x} {y}\n' for x, y in qs)


def cases(r):
    text = 'the red fox saw the old dog near the red barn'.split()
    out = [fmt(text, [('the', 'red'), ('fox', 'barn'), ('dog', 'the')]), fmt(['x', 'y'], [('y', 'x')]),
           fmt(['b', 'a', 'a', 'a', 'b'], [('a', 'b'), ('b', 'a')])]
    for n, vocab, q in [(20, 5, 10), (2000, 30, 50), (40000, 200, 100)]:
        pool = [''.join(r.choice('abcdefgh') for _ in range(r.randint(1, 4))) for _ in range(vocab)]
        pool = sorted(set(pool))
        words = [r.choice(pool) for _ in range(n)]
        present = sorted(set(words))
        qs = [tuple(r.sample(present, 2)) for _ in range(q)]
        out.append(fmt(words, qs))
    return out
