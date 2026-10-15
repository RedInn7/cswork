LEVEL = '简单'
TAGS = ['栈', '队列', '设计']
SAMPLES = 1


def run(s, pour_each_time=False, lifo=False):
    lines = s.split('\n')
    q = int(lines[0])
    inbox, outbox, out = [], [], []
    for op in lines[1:q + 1]:
        if op.startswith('push'):
            inbox.append(int(op.split()[1]))
        elif lifo:
            out.append(inbox.pop() if inbox else -1)
        else:
            if pour_each_time or not outbox:
                # The mistake pours even when outbox still holds older elements.
                while inbox:
                    outbox.append(inbox.pop())
            out.append(outbox.pop() if outbox else -1)
    return '\n'.join(map(str, out))


def solve(s):
    return run(s)


def wrong_pour_every_pop(s):
    return run(s, pour_each_time=True)


def wrong_single_stack(s):
    return run(s, lifo=True)


def ops(r, q, p_push):
    lines = []
    for _ in range(q):
        lines.append(f'push {r.randint(-10**9, 10**9)}' if r.random() < p_push else 'pop')
    return f'{q}\n' + '\n'.join(lines) + '\n'


def cases(r):
    out = ['7\npush 1\npush 2\npop\npush 3\npop\npop\npop\n', '1\npop\n', '3\npush -5\npop\npop\n',
           '6\npush 1\npush 2\npop\npush 3\npush 4\npop\n']
    for q, p in [(20, 0.5), (200, 0.6), (5000, 0.4), (20000, 0.55)]:
        out.append(ops(r, q, p))
    return out
