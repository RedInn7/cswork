LEVEL = '简单'
TAGS = ['栈', '数组', '设计']
SAMPLES = 1
MAX_N = (1000, 10000)


def run(s, capacity_check=True, shared=False):
    lines = s.split('\n')
    c, q = map(int, lines[0].split())
    stacks, out = [[], [], []], []
    for line in lines[1:q + 1]:
        op, *args = line.split()
        k = int(args[0])
        if op == 'push':
            full = sum(map(len, stacks)) >= 3 * c if shared else len(stacks[k]) >= c
            if not (capacity_check and full):
                stacks[k].append(int(args[1]))
        elif op == 'pop':
            out.append(stacks[k].pop() if stacks[k] else -1)
        elif op == 'peek':
            out.append(stacks[k][-1] if stacks[k] else -1)
        else:
            out.append('false' if stacks[k] else 'true')
    return '\n'.join(map(str, out))


def solve(s):
    return run(s)


def wrong_no_capacity(s):
    return run(s, capacity_check=False)


def wrong_shared_capacity(s):
    # Lets one stack use the others' free room: the 3c slots are shared.
    return run(s, shared=True)


def ops(r, c, q, p_push):
    lines = []
    for _ in range(q):
        k = r.randrange(3) if r.random() < 0.8 else 0
        p = r.random()
        if p < p_push:
            lines.append(f'push {k} {r.randint(0, 10**9)}')
        else:
            lines.append(r.choice(['pop', 'pop', 'peek', 'empty']) + f' {k}')
    return f'{c} {q}\n' + '\n'.join(lines) + '\n'


def cases(r):
    out = ['2 8\npush 1 4\npush 1 9\npush 1 6\npeek 1\npop 1\npop 1\npop 1\nempty 0\n',
           '2 9\npush 1 5\npush 1 6\npush 1 7\npeek 1\npop 1\npop 1\npop 1\nempty 1\nempty 0\n']
    for c, q, p in [(1, 20, 0.6), (3, 200, 0.7), (5, 3000, 0.75), (1000, 10000, 0.6), (20, 8000, 0.8)]:
        out.append(ops(r, c, q, p))
    return out
