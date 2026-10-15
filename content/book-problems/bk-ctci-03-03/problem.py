LEVEL = '中等'
TAGS = ['栈', '设计']
SAMPLES = 1


def run(s, remove_empty=True, zero_cap_check=True):
    lines = s.split('\n')
    cap, q = map(int, lines[0].split())
    piles, out = [], []

    def take(i):
        while not remove_empty and piles and not piles[-1]:
            piles.pop()
        if i is None:
            i = len(piles) - 1
        if not 0 <= i < len(piles) or not piles[i]:
            return -1
        v = piles[i].pop()
        if not piles[i] and remove_empty:
            del piles[i]
        return v

    for line in lines[1:q + 1]:
        op, *args = line.split()
        if op == 'push':
            if cap <= 0 and zero_cap_check:
                continue
            if not piles or len(piles[-1]) == cap:
                piles.append([])
            piles[-1].append(int(args[0]))
        elif op == 'pop':
            out.append(take(None))
        else:
            out.append(take(int(args[0])))
    return '\n'.join(map(str, out))


def solve(s):
    return run(s)


def wrong_keeps_empty_piles(s):
    # Leaves an emptied pile in place, so the numbering never shifts.
    return run(s, remove_empty=False)


def wrong_zero_capacity(s):
    # Never checks cap = 0: each push opens a pile and lands one plate on it.
    return run(s, zero_cap_check=False)


def ops(r, cap, q, piles):
    lines = []
    for _ in range(q):
        p = r.random()
        if p < 0.55:
            lines.append(f'push {r.randint(0, 10**9)}')
        elif p < 0.75:
            lines.append('pop')
        else:
            lines.append(f'popAt {r.randint(0, piles)}')
    return f'{cap} {q}\n' + '\n'.join(lines) + '\n'


def cases(r):
    out = ['2 7\npush 5\npush 8\npush 6\npopAt 0\npop\npopAt 0\npop\n', '0 4\npush 5\npush 6\npop\npopAt 0\n',
           '1 6\npush 1\npush 2\npush 3\npopAt 0\npopAt 0\npopAt 1\n', '3 5\npop\npopAt 0\npopAt 100000\npush 9\npopAt 0\n']
    for cap, q, piles in [(1, 30, 5), (2, 300, 10), (5, 5000, 50), (0, 50, 3), (1000, 8000, 10), (3, 10000, 1000)]:
        out.append(ops(r, cap, q, piles))
    return out
