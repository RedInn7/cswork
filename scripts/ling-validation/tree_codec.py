"""Authored canonical binary-tree transport; no downloaded source dependencies.

A level-order list contains integers and None. Only non-null parents consume
up to two following child tokens. Empty tree = []; redundant trailing nulls,
null roots and unreachable tokens are rejected. This is not heap indexing.
"""
from collections import deque

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def from_level_order(values):
    if type(values) is not list:
        raise ValueError('Tree transport must be a list')
    if not values:
        return None
    if values[0] is None or values[-1] is None:
        raise ValueError('Tree transport must have a non-null root and last token')
    for value in values:
        if value is not None and type(value) is not int:
            raise ValueError('Tree tokens must be integers or null')
    root = TreeNode(values[0])
    queue = deque([root])
    index = 1
    while index < len(values):
        if not queue:
            raise ValueError('Tree contains unreachable tokens')
        parent = queue.popleft()
        for side in ('left', 'right'):
            if index == len(values):
                break
            value = values[index]
            index += 1
            if value is not None:
                child = TreeNode(value)
                setattr(parent, side, child)
                queue.append(child)
    return root

def to_level_order(root):
    if root is None:
        return []
    queue = deque([root])
    result = []
    while queue:
        node = queue.popleft()
        result.append(node.val if node is not None else None)
        if node is not None:
            queue.extend((node.left, node.right))
    while result and result[-1] is None:
        result.pop()
    return result

def valid_tree(values, *, min_nodes=0, max_nodes=100000, min_value=-2**31,
               max_value=2**31-1, max_depth=None, complete=False, bst=False):
    """Assert the real node/value/shape constraints; return non-null node count."""
    try:
        root = from_level_order(values)
    except ValueError as error:
        raise AssertionError(str(error)) from error
    queue = deque([(root, 1, None, None)]) if root else deque()
    count = 0
    while queue:
        node, depth, lower, upper = queue.popleft()
        count += 1
        assert min_value <= node.val <= max_value
        if max_depth is not None:
            assert depth <= max_depth
        if bst:
            assert lower is None or lower < node.val
            assert upper is None or node.val < upper
        if node.left:
            queue.append((node.left, depth+1, lower, node.val))
        if node.right:
            queue.append((node.right, depth+1, node.val, upper))
    assert min_nodes <= count <= max_nodes
    if complete:
        assert None not in values
    return count
