LEVEL = '简单'
TAGS = ['链表']
SAMPLES = 2


def parse(s):
    a = s.split()
    n = int(a[0])
    return a[1:n + 1], a[n + 1]


def solve(s):
    values, v = parse(s)
    return ' '.join(x for x in values if x != v)


def wrong_keeps_head(s):
    # Looks only at the successors of each node, so the head is never removed.
    values, v = parse(s)
    return ' '.join(values[:1] + [x for x in values[1:] if x != v])


def wrong_removes_next(s):
    # Unlinks the node after the match instead of the match itself.
    values, v = parse(s)
    i = values.index(v)
    return ' '.join(values[:i + 1] + values[i + 2:])


def fmt(values, v):
    return f'{len(values)}\n{" ".join(map(str, values))}\n{v}\n'


def cases(r):
    out = [fmt([6, 2, 8, 3], 8), fmt([6, 2, 8, 3], 6), fmt([7], 7), fmt([1, 2], 2), fmt([-3, 0, 3], 3)]
    for n in [5, 50, 1000]:
        values = r.sample(range(-10**9, 10**9), n)
        for v in (values[0], r.choice(values), values[-1]):
            out.append(fmt(values, v))
    values = r.sample(range(-10**9, 10**9), 15000)
    out.append(fmt(values, r.choice(values)))
    return out
