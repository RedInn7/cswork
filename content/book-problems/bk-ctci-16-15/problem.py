from collections import Counter

LEVEL = '简单'
TAGS = ['哈希表', '字符串']
SAMPLES = 1


def pairs(s):
    lines = s.split('\n')
    return [line.split() for line in lines[1:int(lines[0]) + 1]]


def score(sol, guess):
    hits = sum(a == b for a, b in zip(sol, guess))
    left = [(a, b) for a, b in zip(sol, guess) if a != b]
    a, b = Counter(x for x, _ in left), Counter(y for _, y in left)
    return hits, sum(min(a[c], b[c]) for c in a)


def solve(s):
    return '\n'.join('%d %d' % score(a, b) for a, b in pairs(s))


def wrong_hits_counted_again(s):
    # Counts pseudo-hits over all slots, hits included, then subtracts nothing.
    out = []
    for sol, guess in pairs(s):
        hits = sum(a == b for a, b in zip(sol, guess))
        a, b = Counter(sol), Counter(guess)
        out.append(f'{hits} {sum(min(a[c], b[c]) for c in a)}')
    return '\n'.join(out)


def wrong_no_minimum(s):
    # Scores every unmatched guess ball whose colour is anywhere among the unmatched solution balls.
    out = []
    for sol, guess in pairs(s):
        hits = sum(a == b for a, b in zip(sol, guess))
        left = [(a, b) for a, b in zip(sol, guess) if a != b]
        pool = {a for a, _ in left}
        out.append(f'{hits} {sum(b in pool for _, b in left)}')
    return '\n'.join(out)


def fmt(ps):
    return f'{len(ps)}\n' + ''.join(f'{a} {b}\n' for a, b in ps)


def cases(r):
    word = lambda: ''.join(r.choice('RYGB') for _ in range(4))
    out = [fmt([('RGBY', 'GGRR')]), fmt([('RRRR', 'RRRR'), ('RGBY', 'YBGR'), ('RRGG', 'GGRR'), ('YYYY', 'BBBB'),
                                         ('RYYB', 'YRRY')])]
    for t in (20, 1000, 10000):
        out.append(fmt([(word(), word()) for _ in range(t)]))
    return out
