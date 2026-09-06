"""Execute only synthetic authored classes; never load downloaded solutions."""
import io
import json
import sys
import unittest
from unittest.mock import patch
from generate_batch import wrapper
from batches.selected_trees1 import PROBLEMS

class TreeWrapperTest(unittest.TestCase):
    def run_authored(self, pid, source, cases, batch=False):
        spec = PROBLEMS[pid]
        program = wrapper(spec, source)
        stdin = json.dumps(cases) if batch else spec['encode'](cases[0])
        stdout = io.StringIO()
        previous_limit = sys.getrecursionlimit()
        try:
            with patch.object(sys, 'stdin', io.StringIO(stdin)), patch.object(sys, 'stdout', stdout), patch.object(sys, 'argv', ['synthetic.py'] + (['--batch'] if batch else [])):
                exec(program, {'__name__': '__main__'})
        finally:
            sys.setrecursionlimit(previous_limit)
        return stdout.getvalue()

    def test_sparse_tree_uses_nonnull_parent_queue_and_annotation_is_bound(self):
        # Under heap indexing token 3 has a missing parent; the intended sparse
        # queue encoding attaches it to root.right.left instead.
        source = '''class Solution:
    def maxDepth(self, root: TreeNode) -> int:
        if root is None: return -1
        assert isinstance(root, TreeNode)
        assert root.left is None
        assert root.right.val == 2
        return root.right.left.val
'''
        cases = [[[1, None, 2, 3]], [[]]]
        self.assertEqual(self.run_authored(104, source, cases), '3\n')
        self.assertEqual(self.run_authored(104, source, cases, True), '3\n-1\n')
        self.assertEqual(cases, [[[1, None, 2, 3]], [[]]])

    def test_two_tree_positions_convert_in_both_paths(self):
        source = '''class Solution:
    def isSameTree(self, p: TreeNode, q: TreeNode) -> bool:
        assert p is None or isinstance(p, TreeNode)
        assert q is None or isinstance(q, TreeNode)
        if p is None or q is None: return p is q
        return p.right.left.val == q.left.right.val
'''
        cases = [[[1, None, 2, 3], [4, 5, None, None, 3]], [[], []], [[], [1]]]
        self.assertEqual(self.run_authored(100, source, cases), '1\n')
        self.assertEqual(self.run_authored(100, source, cases, True), '1\n1\n0\n')

    def test_scalar_arguments_are_not_converted(self):
        source = '''class Solution:
    def hasPathSum(self, root: TreeNode, targetSum: int) -> bool:
        assert type(targetSum) is int
        return root is not None and root.val == targetSum
'''
        cases = [[[7], 7], [[7], 8]]
        self.assertEqual(self.run_authored(112, source, cases), '1\n')
        self.assertEqual(self.run_authored(112, source, cases, True), '1\n0\n')

    def test_ordered_array_results_keep_stdio_count_and_json_batch(self):
        source = '''class Solution:
    def preorderTraversal(self, root: TreeNode) -> list:
        result=[]
        stack=[root] if root else []
        while stack:
            node=stack.pop(); result.append(node.val)
            if node.right: stack.append(node.right)
            if node.left: stack.append(node.left)
        return result
'''
        cases = [[[1, 2, 3, 4]], [[]]]
        self.assertEqual(self.run_authored(144, source, cases), '4\n1 2 4 3\n')
        self.assertEqual([json.loads(line) for line in self.run_authored(144, source, cases, True).splitlines()], [[1, 2, 4, 3], []])

    def test_tree_position_metadata_and_malformed_transports_rejected(self):
        for positions in ([True], [-1], [0, 0], '0'):
            with self.subTest(positions=positions), self.assertRaises(ValueError):
                wrapper({**PROBLEMS[104], 'treeArgs': positions}, 'class Solution: pass')
        source = 'class Solution:\n    def maxDepth(self, root: TreeNode): return 0\n'
        for values in ([None], [1, None, None, 2], [True], [1, None]):
            with self.subTest(values=values), self.assertRaises(ValueError):
                self.run_authored(104, source, [[values]], True)

if __name__ == '__main__':
    unittest.main()
