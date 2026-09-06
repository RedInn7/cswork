"""Independent structured-result review: synthetic authored programs only."""
import io,json,sys,unittest
from unittest.mock import patch
import result_contract as c
from generate_batch import wrapper
from tree_codec import TreeNode,from_level_order,to_level_order

class StructuredReview(unittest.TestCase):
 def test_null_zero_boolean_are_distinct(self):
  self.assertTrue(c.compare_batch('[0,null,-1]\n',[[0,None,-1]],'nullable-integer-array','jsonl-v1'))
  for actual in ('[null,0,-1]\n','[false,null,-1]\n','[0.0,null,-1]\n','["0",null,-1]\n'):
   self.assertFalse(c.compare_batch(actual,[[0,None,-1]],'nullable-integer-array','jsonl-v1'))
  self.assertEqual(c.format_result('nullable-integer-array',[0,None,0]),'3\n0 null 0\n')
 def test_nested_boundaries_and_arbitrary_precision(self):
  huge=10**100+1;rows=[[],[huge,-huge],[]]
  self.assertTrue(c.compare_batch(json.dumps(rows)+'\n',[rows],'integer-rows','jsonl-v1'))
  self.assertFalse(c.compare_batch('[[1,2],[3]]\n',[[[1],[2,3]]],'integer-rows','jsonl-v1'))
  self.assertFalse(c.compare_batch('[[1],[2,3]]\n[]\n',[[[1],[2,3]]],'integer-rows','jsonl-v1'))
  for value in ([None],[[True]],[[0.0]],[[[1]]],{'0':[1]}):
   with self.assertRaises(ValueError):c.validate_result('integer-rows',value)
  output=c.format_result('integer-rows',rows);c.validate_expected_output('integer-rows',output)
  self.assertTrue(output.startswith('3\n0\n2 '));self.assertTrue(output.endswith('\n0\n'))
 def test_count_and_resource_boundaries_fail_closed(self):
  for output in ('1 1 null','1 01 0','2 0','0 0','1 2 0','1000001','1 1000001'):
   with self.subTest(output=output),self.assertRaises(ValueError):c.validate_expected_output('integer-rows',output)
  for output in ('1 None','1 false','1 0.0','1 nulL','0 null','2 0','1 0\0','1 0\u00a0'):
   with self.subTest(output=output),self.assertRaises(ValueError):c.validate_expected_output('nullable-integer-array',output)
  with patch.object(c,'MAX_SET_ITEMS',3), patch.object(c,'MAX_ROW_VALUES',3), patch.object(c,'MAX_ROWS',3):
   c.validate_result('integer-rows',[[1,2,3],[]])
   for kind,value in [('integer-rows',[[1,2],[3,4]]),('integer-rows',[[],[],[],[]]),('nullable-integer-array',[None]*4)]:
    with self.assertRaises(ValueError):c.validate_result(kind,value)
  with patch.object(c,'MAX_OUTPUT_BYTES',8):
   with self.assertRaises(ValueError):c.format_result('nullable-integer-array',[None,None])
 def test_tree_output_rejects_cycles_shared_nodes_and_boolean_values(self):
  root=TreeNode(0);root.right=TreeNode(0)
  self.assertEqual(to_level_order(root),[0,None,0])
  self.assertEqual(to_level_order(from_level_order([0,None,0])),[0,None,0])
  self.assertEqual(to_level_order(None),[])
  for value in (False,0.0,None):
   with self.assertRaises(ValueError):to_level_order(TreeNode(value))
  root=TreeNode(1);root.left=root
  with self.assertRaises(ValueError):to_level_order(root)
  shared=TreeNode(0);root=TreeNode(1,shared,shared)
  with self.assertRaises(ValueError):to_level_order(root)
 def test_tree_output_node_limit(self):
  root=TreeNode(0);node=root
  for i in range(100000):node.right=TreeNode(i);node=node.right
  with self.assertRaises(ValueError):to_level_order(root)
 def execute(self,spec,source,args,batch=False):
  code=wrapper(spec,source);out=io.StringIO();limit=sys.getrecursionlimit()
  try:
   with patch.object(sys,'stdin',io.StringIO(json.dumps(args if batch else args[0]))),patch.object(sys,'stdout',out),patch.object(sys,'argv',['authored.py']+(['--batch'] if batch else [])):
    exec(code,{'__name__':'__main__'})
  finally:sys.setrecursionlimit(limit)
  return out.getvalue()
 def test_result_tree_return_and_argument_zero_adapters(self):
  spec=dict(method='transform',parse='args=json.load(sys.stdin)',treeArgs=[0],resultTree='return',resultKind='nullable-integer-array')
  source='class Solution:\n def transform(self,root):\n  return root\n'
  self.assertEqual(self.execute(spec,source,[[[0,None,0]]]),'3\n0 null 0\n')
  self.assertEqual(self.execute(spec,source,[[[]],[[0,None,0]]],True),'[]\n[0, null, 0]\n')
  spec['resultTree']='arg0'
  source='class Solution:\n def transform(self,root):\n  root.right=TreeNode(0)\n  return None\n'
  self.assertEqual(self.execute(spec,source,[[[0]]]),'3\n0 null 0\n')
  source='class Solution:\n def transform(self,root):\n  root.left=root\n'
  with self.assertRaises(ValueError):self.execute(spec,source,[[[0]]])
 def test_wrapper_rows_never_flatten_or_coerce(self):
  spec=dict(method='rows',parse='args=json.load(sys.stdin)',resultKind='integer-rows')
  source='class Solution:\n def rows(self,x): return x\n'
  args=[[[[],[0,10**50],[]]]]
  self.assertEqual(self.execute(spec,source,args),f'3\n0\n2 0 {10**50}\n0\n')
  for bad in ([[None]],[[False]],[[1.0]]):
   with self.assertRaises(ValueError):self.execute(spec,source,[[bad]])

if __name__=='__main__':unittest.main()
