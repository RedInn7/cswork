from collections import deque

LEVEL = '中等'
TAGS = ['队列', '单调队列', '设计']
SAMPLES = 1


def run(s, drop_equal=False, sticky_max=False):
    lines = s.split('\n')
    queue, best, out = deque(), deque(), []
    top = -1
    for op in lines[1:int(lines[0]) + 1]:
        if op.startswith('push'):
            x = int(op.split()[1])
            queue.append(x)
            top = max(top, x)
            while best and (best[-1] <= x if drop_equal else best[-1] < x):
                best.pop()
            best.append(x)
        elif op == 'pop':
            if not queue:
                out.append(-1)
                continue
            x = queue.popleft()
            if best and best[0] == x:
                best.popleft()
            out.append(x)
            if not queue:
                top = -1
        elif sticky_max:
            # Remembers the largest value ever pushed and never lowers it on pop.
            out.append(top)
        else:
            out.append(best[0] if best else -1)
    return '\n'.join(map(str, out))


def solve(s):
    return run(s)


def wrong_drops_equal_values(s):
    return run(s, drop_equal=True)


def wrong_sticky_max(s):
    return run(s, sticky_max=True)


def ops(r, q, v):
    lines = []
    for _ in range(q):
        p = r.random()
        lines.append(f'push {r.randint(1, v)}' if p < 0.45 else 'pop' if p < 0.75 else 'max')
    return f'{q}\n' + '\n'.join(lines) + '\n'


def cases(r):
    out = ['7\npush 1\npush 2\nmax\npop\nmax\npop\nmax\n', '2\npop\nmax\n',
           '7\npush 5\npush 5\npop\nmax\npop\nmax\npop\n', '6\npush 3\npush 1\npush 2\npop\nmax\npop\n']
    for q, v in [(30, 5), (300, 3), (5000, 1000), (20000, 10**9), (20000, 4)]:
        out.append(ops(r, q, v))
    return out
