from collections import Counter

LEVEL = '中等'
TAGS = ['字符串', '双指针']
SAMPLES = 1


def pairs(s):
    lines = s.split('\n')
    return [line.split() for line in lines[1:int(lines[0]) + 1]]


def one_away(a, b):
    if len(a) < len(b):
        a, b = b, a
    if len(a) - len(b) > 1:
        return False
    i = 0
    while i < len(b) and a[i] == b[i]:
        i += 1
    return a[i + 1:] == b[i + 1:] if len(a) == len(b) else a[i + 1:] == b[i:]


def answer(s, f):
    return '\n'.join('true' if f(a, b) else 'false' for a, b in pairs(s))


def solve(s):
    return answer(s, one_away)


def wrong_position_count(s):
    # Compares position by position even when the lengths differ.
    def f(a, b):
        if abs(len(a) - len(b)) > 1:
            return False
        return sum(x != y for x, y in zip(a, b)) + abs(len(a) - len(b)) <= 1
    return answer(s, f)


def wrong_letter_counts(s):
    # Compares letter counts and ignores the order.
    def f(a, b):
        d = (Counter(a) - Counter(b)) + (Counter(b) - Counter(a))
        return abs(len(a) - len(b)) <= 1 and sum(d.values()) <= 2
    return answer(s, f)


def fmt(ps):
    return f'{len(ps)}\n' + ''.join(f'{a} {b}\n' for a, b in ps)


def edit(r, w, letters):
    k = r.randrange(len(w) + 1)
    op = r.randrange(3)
    if op == 0:
        return w[:k] + r.choice(letters) + w[k:]
    if op == 1 and len(w) > 1 and k < len(w):
        return w[:k] + w[k + 1:]
    k = min(k, len(w) - 1)
    return w[:k] + r.choice(letters) + w[k + 1:]


def cases(r):
    out = [fmt([('stone', 'tone'), ('ring', 'rings'), ('rope', 'robe'), ('rope', 'rapt')]),
           fmt([('a', 'a'), ('a', 'b'), ('a', 'ab'), ('ab', 'ba'), ('abc', 'acb'), ('abc', 'a'), ('teacher', 'taches'),
                ('horse', 'hose'), ('abcd', 'abdc'), ('x', 'xyz')])]
    for t, n, letters in [(50, 6, 'ab'), (300, 30, 'abc'), (1000, 200, 'abcdefghijklmnopqrstuvwxyz')]:
        ps = []
        for k in range(t):
            a = ''.join(r.choice(letters) for _ in range(r.randint(1, n)))
            b = a
            for _ in range(k % 3):
                b = edit(r, b, letters)
            if k % 7 == 0 and len(a) > 1:
                b = a[1:] + a[0]
            ps.append((a, b))
        out.append(fmt(ps))
    return out
