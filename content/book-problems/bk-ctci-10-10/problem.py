LEVEL = '中等'
TAGS = ['树状数组', '二叉搜索树', '设计']
SAMPLES = 1
TOP = 50001


def run(s, strict=False, distinct=False):
    lines = s.split('\n')
    tree, seen, out = [0] * (TOP + 1), set(), []
    for line in lines[1:int(lines[0]) + 1]:
        op, x = line.split()
        x = int(x) + 1
        if op == 'track':
            if distinct and x in seen:
                continue
            seen.add(x)
            while x <= TOP:
                tree[x] += 1
                x += x & -x
        else:
            x -= strict
            total = 0
            while x > 0:
                total += tree[x]
                x -= x & -x
            out.append(total)
    return '\n'.join(map(str, out))


def solve(s):
    return run(s)


def wrong_strictly_less(s):
    return run(s, strict=True)


def wrong_distinct_only(s):
    # Counts each value once, as a tree without counts per node would.
    return run(s, distinct=True)


def ops(r, q, v):
    lines = [f'{"track" if r.random() < 0.6 else "rank"} {r.randint(0, v)}' for _ in range(q)]
    return f'{q}\n' + '\n'.join(lines) + '\n'


def cases(r):
    out = ['10\ntrack 8\ntrack 3\ntrack 8\ntrack 1\nrank 3\nrank 8\ntrack 6\nrank 7\nrank 0\nrank 10\n',
           '3\nrank 0\ntrack 0\nrank 0\n', '4\ntrack 50000\nrank 49999\nrank 50000\ntrack 7\n']
    for q, v in [(20, 10), (300, 5), (5000, 50000), (15000, 1000)]:
        out.append(ops(r, q, v))
    return out
