import heapq

LEVEL = '中等'
TAGS = ['栈', '堆', '设计']
SAMPLES = 1
MAX_N = 6000


def run(s, largest=False, pop_latest=False):
    lines = s.split('\n')
    heap, pushed, out = [], [], []
    for line in lines[1:int(lines[0]) + 1]:
        op, *args = line.split()
        if op == 'push':
            v = int(args[0])
            heapq.heappush(heap, -v if largest else v)
            pushed.append(v)
        elif op == 'pop':
            if heap:
                if pop_latest:
                    # Removes the most recent push, as a plain stack would.
                    v = pushed.pop()
                    heap.remove(v)
                    heapq.heapify(heap)
                else:
                    v = heapq.heappop(heap)
                    pushed.remove(-v if largest else v)
        elif op == 'peek':
            out.append((-heap[0] if largest else heap[0]) if heap else -1)
        else:
            out.append('false' if heap else 'true')
    return '\n'.join(map(str, out))


def solve(s):
    return run(s)


def wrong_largest_on_top(s):
    return run(s, largest=True)


def wrong_pops_latest(s):
    return run(s, pop_latest=True)


def ops(r, q, v):
    lines = []
    for _ in range(q):
        p = r.random()
        lines.append(f'push {r.randint(1, v)}' if p < 0.45 else 'pop' if p < 0.7 else 'peek' if p < 0.95 else 'isEmpty')
    return f'{q}\n' + '\n'.join(lines) + '\n'


def cases(r):
    out = ['7\npush 7\npush 4\npush 9\npeek\npop\npeek\nisEmpty\n', '4\npop\npeek\nisEmpty\npop\n',
           '6\npush 5\npush 5\npop\npeek\npop\npeek\n']
    # The hidden cases stay small enough for the mistakes' list scans.
    for q, v in [(30, 10), (300, 3), (3000, 10**9), (6000, 100)]:
        out.append(ops(r, q, v))
    return out
