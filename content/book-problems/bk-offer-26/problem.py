from trees import Node, dump, parse, random_tree

LEVEL = '中等'
TAGS = ['二叉树', '深度优先搜索']
SAMPLES = 2


def nodes(root):
    stack, out = [root], []
    while stack:
        node = stack.pop()
        if node:
            out.append(node)
            stack += [node.left, node.right]
    return out


def covers(a, b):
    stack = [(a, b)]
    while stack:
        x, y = stack.pop()
        if y is None:
            continue
        if x is None or x.val != y.val:
            return False
        stack += [(x.left, y.left), (x.right, y.right)]
    return True


def equal(a, b):
    stack = [(a, b)]
    while stack:
        x, y = stack.pop()
        if x is None and y is None:
            continue
        if x is None or y is None or x.val != y.val:
            return False
        stack += [(x.left, y.left), (x.right, y.right)]
    return True


def trees(s):
    lines = s.split('\n')
    return parse(lines[0]), parse(lines[1])


def answer(ok):
    return 'true' if ok else 'false'


def solve(s):
    a, b = trees(s)
    return answer(any(covers(x, b) for x in nodes(a)))


def wrong_whole_subtree(s):
    # Demands an identical subtree, extra nodes of A included.
    a, b = trees(s)
    return answer(any(equal(x, b) for x in nodes(a)))


def wrong_root_only(s):
    # Compares at A's root and never tries the other nodes.
    a, b = trees(s)
    return answer(covers(a, b))


def prune(r, node, keep):
    """A copy of the top of node's subtree: each child kept with probability keep."""
    copy = Node(node.val)
    if node.left and r.random() < keep:
        copy.left = prune(r, node.left, keep)
    if node.right and r.random() < keep:
        copy.right = prune(r, node.right, keep)
    return copy


def case(a, b):
    return f'{dump(a)}\n{dump(b)}\n'


def cases(r):
    out = ['8 6 9 2 7 null 3\n6 2\n', '5 1 null 4\n5 4\n', '1\n1\n', '1 2 3\n3 1\n', '1 2\n1 null 2\n', '2 2 2 2\n2 2 2 2 2\n']
    for n, v, keep in [(8, 2, 0.5), (30, 3, 0.7), (200, 3, 0.8), (2000, 4, 0.9), (10000, 3, 0.85)]:
        a = random_tree(r, n, lambda: r.randint(-v, v))
        for _ in range(2):
            b = prune(r, r.choice(nodes(a)), keep)
            out.append(case(a, b))
        b = prune(r, r.choice(nodes(a)), keep)
        tweak = r.choice(nodes(b))
        tweak.val += 1
        out.append(case(a, b))
    # A large B: most of a big subtree, then the same with one value changed deep inside.
    a = random_tree(r, 3000, lambda: r.randint(-2, 2))
    big = max((x for x in nodes(a) if len(nodes(x)) <= 1000), key=lambda x: len(nodes(x)))
    b = prune(r, big, 0.97)
    out.append(case(a, b))
    nodes(b)[-1].val += 7
    out.append(case(a, b))
    return out
