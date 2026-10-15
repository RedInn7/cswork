"""Binary trees as the book problems write them: one line of level-order values,
"null" for a missing child, trailing nulls left out (the LeetCode convention)."""


class Node:
    def __init__(self, val, left=None, right=None):
        self.val, self.left, self.right = val, left, right


def parse(line):
    tokens = line.split()
    if not tokens or tokens[0] == 'null':
        return None
    root = Node(int(tokens[0]))
    queue, k = [root], 1
    for node in queue:
        for side in ('left', 'right'):
            if k < len(tokens):
                if tokens[k] != 'null':
                    child = Node(int(tokens[k]))
                    setattr(node, side, child)
                    queue.append(child)
                k += 1
    return root


def dump(root):
    out, queue = [], [root]
    for node in queue:
        if node is None:
            out.append('null')
        else:
            out.append(str(node.val))
            queue += [node.left, node.right]
    while out and out[-1] == 'null':
        out.pop()
    return ' '.join(out)


def random_tree(r, n, value):
    """n nodes in a random shape; value() draws each node's value."""
    if n == 0:
        return None
    root = Node(value())
    nodes = [root]
    while len(nodes) < n:
        parent = r.choice(nodes)
        side = r.choice(('left', 'right'))
        if getattr(parent, side) is None:
            child = Node(value())
            setattr(parent, side, child)
            nodes.append(child)
    return root


def bst(values):
    """The search tree built by inserting values in order (distinct values)."""
    root = None
    for v in values:
        if root is None:
            root = Node(v)
            continue
        node = root
        while True:
            side = 'left' if v < node.val else 'right'
            if getattr(node, side) is None:
                setattr(node, side, Node(v))
                break
            node = getattr(node, side)
    return root


def chain(n, value, side='left'):
    """A path of n nodes, each the given child of the one before: the deepest tree."""
    root = node = Node(value())
    for _ in range(n - 1):
        child = Node(value())
        setattr(node, side, child)
        node = child
    return root
