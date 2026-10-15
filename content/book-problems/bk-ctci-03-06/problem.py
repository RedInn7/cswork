from collections import deque

LEVEL = '简单'
TAGS = ['队列', '设计']
SAMPLES = 1
MAX_N = 8000


def run(s, dogs_first=False, by_id=False):
    lines = s.split('\n')
    queues, out, clock = (deque(), deque()), [], 0
    for line in lines[1:int(lines[0]) + 1]:
        op, *args = line.split()
        if op == 'enqueue':
            queues[int(args[1])].append((clock, int(args[0])))
            clock += 1
            continue
        if op == 'dequeueCat':
            kind = 0
        elif op == 'dequeueDog':
            kind = 1
        else:
            cat, dog = queues
            if not cat or not dog:
                kind = 0 if cat else 1
            elif dogs_first:
                kind = 1
            else:
                key = (lambda x: x[1]) if by_id else (lambda x: x[0])
                kind = 0 if key(cat[0]) < key(dog[0]) else 1
        if queues[kind]:
            out.append(f'{queues[kind].popleft()[1]} {kind}')
        else:
            out.append('-1 -1')
    return '\n'.join(out)


def solve(s):
    return run(s)


def wrong_dogs_first(s):
    # dequeueAny checks the dogs before comparing arrival.
    return run(s, dogs_first=True)


def wrong_smallest_id(s):
    # Compares ids as if they gave the arrival order.
    return run(s, by_id=True)


def ops(r, q):
    lines, ids = [], r.sample(range(10**9), q)
    for k in range(q):
        p = r.random()
        if p < 0.5:
            lines.append(f'enqueue {ids[k]} {r.randrange(2)}')
        else:
            lines.append(r.choice(['dequeueAny', 'dequeueAny', 'dequeueDog', 'dequeueCat']))
    return f'{q}\n' + '\n'.join(lines) + '\n'


def cases(r):
    out = ['6\nenqueue 30 0\nenqueue 10 1\nenqueue 20 1\ndequeueAny\ndequeueCat\ndequeueDog\n',
           '3\ndequeueAny\ndequeueCat\ndequeueDog\n', '5\nenqueue 1 1\nenqueue 2 0\ndequeueAny\ndequeueAny\ndequeueAny\n']
    for q in (20, 200, 2000, 8000):
        out.append(ops(r, q))
    return out
