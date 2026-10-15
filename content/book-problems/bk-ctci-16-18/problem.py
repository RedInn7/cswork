LEVEL = '中等'
TAGS = ['字符串', '枚举']
SAMPLES = 1


def pairs(s):
    lines = s.split('\n')
    return [(lines[1 + 2 * k].strip(), lines[2 + 2 * k].strip()) for k in range(int(lines[0]))]


def matches(p, v, distinct=True, empty=True):
    ca, cb = p.count('a'), p.count('b')
    n = len(v)
    for la in range(0, n + 1):
        if ca * la > n:
            break
        if cb == 0:
            if ca * la != n:
                continue
            lb = 0
        else:
            if (n - ca * la) % cb:
                continue
            lb = (n - ca * la) // cb
        if not empty and ((ca and la == 0) or (cb and lb == 0)):
            continue
        pieces, k = {'a': None, 'b': None}, 0
        ok = True
        for c in p:
            length = la if c == 'a' else lb
            piece = v[k:k + length]
            k += length
            if pieces[c] is None:
                pieces[c] = piece
            elif pieces[c] != piece:
                ok = False
                break
        if ok and (not distinct or pieces['a'] != pieces['b']):
            return True
    return False


def answer(s, **kw):
    return '\n'.join('true' if matches(p, v, **kw) else 'false' for p, v in pairs(s))


def solve(s):
    return answer(s)


def wrong_allows_equal(s):
    return answer(s, distinct=False)


def wrong_no_empty(s):
    return answer(s, empty=False)


def fmt(ps):
    return f'{len(ps)}\n' + ''.join(f'{p}\n{v}\n' for p, v in ps)


def cases(r):
    out = [fmt([('abba', 'dogcatcatdog'), ('abba', 'dogcatcatfish'), ('abba', 'dogdogdogdog'), ('aabbb', 'xxxxx')]),
           fmt([('a', 'x'), ('b', 'xyz'), ('ab', 'x'), ('aa', 'xyz'), ('ababb', 'xxxxx'), ('bbba', 'xxxxxxy'), ('abab', 'xyxy'),
                ('aaaa', 'xyxyxyxy'), ('aba', 'xyx'), ('abba', 'xyyx'), ('baab', 'zzzz'), ('aabb', 'xyz')])]
    for t, n in [(20, 8), (20, 60), (10, 1000)]:
        ps = []
        for k in range(t):
            p = ''.join(r.choice('ab') for _ in range(r.randint(1, min(n, 12))))
            a = ''.join(r.choice('xy') for _ in range(r.randint(0, 4)))
            b = ''.join(r.choice('xy') for _ in range(r.randint(0, 4)))
            v = ''.join(a if c == 'a' else b for c in p)
            if k % 3 == 2 or not v:
                v = ''.join(r.choice('xy') for _ in range(r.randint(1, n)))
            ps.append((p, v[:1000]))
        out.append(fmt(ps))
    out.append(fmt([('ab' * 500, 'x' * 1000), ('a' * 999 + 'b', 'x' * 1000), ('aabbb' * 200, 'x' * 1000)]))
    return out
