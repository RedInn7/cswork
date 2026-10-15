LEVEL = '简单'
TAGS = ['链表', '栈']
SAMPLES = 2


def walk(s):
    a = list(map(int, s.split()))
    n, h = a[0], a[1]
    value, nxt = a[2::2], a[3::2]
    order = []
    while h != -1:
        order.append(value[h])
        h = nxt[h]
    return order


def solve(s):
    return ' '.join(map(str, reversed(walk(s))))


def wrong_input_order(s):
    # Prints the node lines backwards instead of following the links.
    a = list(map(int, s.split()))
    return ' '.join(map(str, reversed(a[2::2])))


def wrong_head_to_tail(s):
    # Follows the links but forgets to reverse.
    return ' '.join(map(str, walk(s)))


def build(r, values):
    n = len(values)
    ids = list(range(n))
    r.shuffle(ids)
    nodes = [None] * n
    for k, i in enumerate(ids):
        nodes[i] = (values[k], ids[k + 1] if k + 1 < n else -1)
    return f'{n} {ids[0]}\n' + ''.join(f'{v} {nx}\n' for v, nx in nodes)


def cases(r):
    out = ['4 2\n5 3\n9 -1\n7 0\n-2 1\n', '1 0\n42 -1\n', '2 1\n3 -1\n8 0\n', '3 0\n1 1\n2 2\n3 -1\n']
    for n, v in [(5, 10**9), (10, 10**9), (1000, 10**9), (15000, 10**6)]:
        out.append(build(r, [r.randint(-v, v) for _ in range(n)]))
    out.append(build(r, [r.randint(-5, 5) for _ in range(30)]))
    return out
