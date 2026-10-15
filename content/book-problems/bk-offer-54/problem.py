from trees import bst, chain, dump, parse

LEVEL = '简单'
TAGS = ['二叉搜索树', '深度优先搜索']
SAMPLES = 1


def descending(s):
    lines = s.split('\n')
    root, k = parse(lines[0]), int(lines[1])
    out, stack, node = [], [], root
    while stack or node:
        while node:
            stack.append(node)
            node = node.right
        node = stack.pop()
        out.append(node.val)
        node = node.left
    return out, k


def solve(s):
    out, k = descending(s)
    return str(out[k - 1])


def wrong_kth_smallest(s):
    out, k = descending(s)
    return str(out[-k])


def wrong_zero_based(s):
    # Counts from zero and stops one node late.
    out, k = descending(s)
    return str(out[min(k, len(out) - 1)])


def case(root, k):
    return f'{dump(root)}\n{k}\n'


def cases(r):
    out = ['5 3 6 2 4 null null 1\n3\n', '1\n1\n', '2 1 3\n1\n', '2 1 3\n3\n']
    for n in (5, 50, 1000):
        root = bst(r.sample(range(-10**9, 10**9), n))
        for k in (1, r.randint(1, n), n):
            out.append(case(root, k))
    out.append(case(bst(r.sample(range(-10**6, 10**6), 10000)), r.randint(1, 10000)))
    down = iter(range(3000, 0, -1))
    out.append(case(chain(3000, lambda: next(down), 'left'), 2999))
    return out
