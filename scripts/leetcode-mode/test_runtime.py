"""Exercise authored solutions only; no downloaded answer is imported/executed."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import os
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
ASSET = json.loads((ROOT / 'lib/content/leetcode-contracts.json').read_text())


def invoke(number, source, stdin, custom=False):
    contract = ASSET['problems']['lc-' + str(number)]
    program = ASSET['support'] + contract['pythonWrapper'].replace('__CSWORK_USER_SOURCE__', source, 1)
    output = io.StringIO()
    with patch.object(sys, 'stdin', io.StringIO(stdin)), patch.object(sys, 'argv', ['main.py'] + (['--leetcode-input'] if custom else [])), contextlib.redirect_stdout(output):
        exec(program, {'__name__': '__main__'})
    return output.getvalue()


class Contracts(unittest.TestCase):
    def test_exact_500_and_public_signatures(self):
        selected = {x['number'] for x in json.loads((ROOT / 'lib/content/ling-curated-500.json').read_text())}
        self.assertEqual(selected, {p['number'] for p in ASSET['problems'].values()})
        for p in ASSET['problems'].values():
            self.assertEqual(p['pythonWrapper'].count('__CSWORK_USER_SOURCE__'), 1)
            self.assertEqual(p['nativeBridge'].count('__CSWORK_NATIVE_COMMAND__'), 1)
            self.assertTrue(all(p['templates'].values()))
            self.assertNotIn('referenceSha256', p)

    def test_500_authored_parsers_roundtrip(self):
        # Import only our test generators, never the downloaded references.
        sys.path.insert(0, str(ROOT / 'scripts/ling-validation'))
        import importlib
        import generate_batch
        import generate
        specs = {n: s for batch in generate_batch.BATCHES for n, s in importlib.import_module('batches.' + batch).PROBLEMS.items()}
        for contract in ASSET['problems'].values():
            n = contract['number']
            cases = specs[n]['edges'] if n in specs else generate.EDGE[n]
            for args in cases[:3]:
                stdin = specs[n]['encode'](args) if n in specs else generate.encode(n, args)
                scope = {'sys': type('Input', (), {'stdin': io.StringIO(stdin)}), 'json': json}
                exec(contract['spec']['parse'], scope)
                self.assertEqual(scope['args'], args, 'lc-' + str(n))

    def test_array_legacy_and_custom(self):
        two_sum = 'class Solution:\n def twoSum(self, nums, target):\n  return [0,1]\n'
        self.assertEqual(invoke(1, two_sum, '[2,7,11]\n9\n', True), '2\n0 1\n')
        self.assertEqual(invoke(69, 'class Solution:\n def mySqrt(self,x):return 2\n', '8\n'), '2\n')

    def test_inplace(self):
        source = 'class Solution:\n def removeDuplicates(self,nums):\n  nums[:2]=[1,2]\n  return 2\n'
        self.assertEqual(invoke(26, source, '[1,1,2]', True), '2\n1 2\n')

    def test_tree_identity(self):
        source = 'class Solution:\n def lowestCommonAncestor(self,root,p,q):\n  assert p is root.left and q is root.right\n  return root\n'
        # Custom LeetCode examples use node values; native calls receive pointers.
        self.assertEqual(invoke(236, source, '[3,1,5]\n1\n5', True), '0\n')

    def test_custom_node_examples_and_missing_targets(self):
        scope = {}
        exec(ASSET['support'], scope)
        runtime = scope['_cswork_runtime']
        self.assertEqual(runtime.custom_args({'number':1644}, [[3,1,5],1,99]), [[3,1,5],{'id':1},{'external':99}])
        self.assertEqual(runtime.custom_args({'number':138}, [[[7,None],[8,0]]]), [[[7,-1],[8,0]]])
        self.assertEqual(runtime.custom_args({'number':160}, [8,[4,1,8,4,5],[5,6,1,8,4,5],2,3]), [[4,1],[5,6,1],[8,4,5]])
        self.assertEqual(runtime.custom_args({'number':160}, [0,[1,2],[3],2,1]), [[1,2],[3],[]])
        with self.assertRaisesRegex(ValueError, 'shared tails'):
            runtime.custom_args({'number':160}, [8,[4,8],[5,9],1,1])
        with self.assertRaisesRegex(ValueError, 'not present'):
            runtime.custom_args({'number':236}, [[3,1,5],1,99])

    def test_linked(self):
        source = 'class Solution:\n def reverseList(self,head):\n  prev=None\n  while head:\n   nxt=head.next;head.next=prev;prev=head;head=nxt\n  return prev\n'
        self.assertEqual(invoke(206, source, '[1,2,3]', True), '3\n3 2 1\n')

    def test_auxiliary_actual_argument_order(self):
        source = 'class Solution:\n def findInMountainArray(self,target,mountainArr):\n  assert target==2 and mountainArr.length()==3\n  return next(i for i in range(3) if mountainArr.get(i)==target)\n'
        self.assertEqual(invoke(1095, source, '2\n[1,3,2]', True), '2\n')

    def test_design_boolean(self):
        source = 'class MyCircularQueue:\n def __init__(self,k):pass\n def isEmpty(self):return True\n'
        self.assertEqual(invoke(622, source, '["MyCircularQueue","isEmpty"]\n[[1],[]]', True), '2\nnull 1\n')

    def test_complex_design(self):
        source = 'class BSTIterator:\n def __init__(self,root):self.root=root\n def next(self):return self.root.val\n def hasNext(self):return False\n'
        self.assertEqual(invoke(173, source, '["BSTIterator","next","hasNext"]\n[[[2]],[],[]]', True), '[null,2,0]\n')

    def test_codec_two_separate_phases(self):
        source = 'class Codec:\n def serialize(self,root):return str(root.val)\n def deserialize(self,data):return TreeNode(int(data))\n'
        self.assertEqual(invoke(297, source, '{"operation":"serialize","trees":[[7],[8]]}'), '["7", "8"]\n')
        self.assertEqual(invoke(297, source, '{"operation":"deserialize","data":["7","8"]}'), '[[7], [8]]\n')
        self.assertEqual(invoke(297, source, '{"operation":"serialize","trees":[[7]]}', True), '["7"]\n')

    def test_user_print_does_not_corrupt_result(self):
        stderr = io.StringIO()
        with contextlib.redirect_stderr(stderr):
            self.assertEqual(invoke(69, 'class Solution:\n def mySqrt(self,x):\n  print("debug", x)\n  return 2\n', '8\n'), '2\n')
        self.assertEqual(stderr.getvalue(), 'debug 8\n')

    def test_native_bridge_transport_and_mutated_array(self):
        scope = {}
        exec(ASSET['support'], scope)
        runtime = scope['_cswork_runtime']
        spec = ASSET['problems']['lc-26']['spec']
        captured = []
        def native(command, **options):
            request = json.loads(options['input'])
            captured.append(request)
            Path('cswork-result.json').write_text(json.dumps({'result': 2, 'args': [[1,2,2]], 'nodes': []}))
            return type('Exit', (), {'returncode': 0})()
        old_directory = Path.cwd()
        with tempfile.TemporaryDirectory() as directory:
            os.chdir(directory)
            try:
                output = io.StringIO()
                with patch.object(runtime.subprocess, 'run', native), patch.object(sys, 'stdin', io.StringIO('[1,1,2]')), patch.object(sys, 'argv', ['main.py', '--leetcode-input']), contextlib.redirect_stdout(output):
                    runtime.native_main(spec, ['./main'])
                self.assertEqual(output.getvalue(), '2\n1 2\n')
            finally:
                os.chdir(old_directory)
        self.assertEqual(captured[0]['args'], [[1,1,2]])
        self.assertEqual(captured[0]['kind'], 'function')

    def test_native_missing_original_nodes_rejected(self):
        scope = {}
        exec(ASSET['support'], scope)
        runtime = scope['_cswork_runtime']
        graph = runtime.Graph()
        graph.encode(runtime.trees.TreeNode(1))
        with self.assertRaisesRegex(ValueError, 'Incomplete'):
            graph.restore([], {})

    def test_graph_restore_preserves_identity(self):
        scope = {}
        exec(ASSET['support'], scope)
        runtime = scope['_cswork_runtime']
        args, context = runtime.prepare({'specialId': 236}, [[3,1,5],1,2])
        graph = runtime.Graph()
        encoded = graph.encode(args)
        records = graph.records()
        graph.restore(records, {'specialId': 236})
        restored = graph.decode(encoded)
        self.assertIs(restored[1], restored[0].left)
        self.assertIs(restored[2], restored[0].right)
        self.assertEqual(runtime.finish({'specialId':236}, restored[0], restored, context), 0)


if __name__ == '__main__':
    unittest.main()
