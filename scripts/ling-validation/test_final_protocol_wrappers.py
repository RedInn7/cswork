"""Only authored synthetic sources execute here; downloaded references stay inert."""
import io,json,sys,unittest
from unittest.mock import patch
from generate_batch import wrapper,result_settings
from result_contract import compare_batch,format_result,validate_result
from batches.selected_nodes1 import PROBLEMS as NODES
from batches.selected_strings1 import PROBLEMS as STRINGS

class FinalProtocolWrappers(unittest.TestCase):
 def run_source(self,spec,source,args,batch=False):
  output=io.StringIO();limit=sys.getrecursionlimit()
  try:
   with patch.object(sys,'stdin',io.StringIO(json.dumps(args if batch else args[0]))),patch.object(sys,'stdout',output),patch.object(sys,'argv',['authored']+(['--batch'] if batch else [])):
    exec(wrapper(spec,source),{'__name__':'__main__'})
  finally:sys.setrecursionlimit(limit)
  return output.getvalue()
 def test_special_identity_and_fresh_case(self):
  source='''class Solution:
    def detectCycle(self, head: ListNode):
        seen=set()
        while head and head not in seen:
            seen.add(head)
            head=head.next
        return head
'''
  args=[[[3,2,0,-4],1],[[1],-1],[[3,2,0,-4],1]]
  self.assertEqual(self.run_source(NODES[142],source,args,True),'1\n-1\n1\n')
  self.assertEqual(self.run_source(NODES[142],source,args),'1\n')
 def test_special_node_symbols_and_sparse_identity(self):
  source='''class Solution:
    def lowestCommonAncestor(self, root: TreeNode, p: TreeNode, q: TreeNode):
        assert p is root.right
        assert q is root.right.left
        return p
'''
  self.assertEqual(self.run_source(NODES[236],source,[[[1,None,2,3],1,2]]),'1\n')
 def test_json_string_batch_multiset(self):
  source='''class Solution:
    def groupAnagrams(self, strs):
        return [list(reversed(strs))]
'''
  args=[[['a','a']],[['eat','tea']]]
  output=self.run_source(STRINGS[49],source,args,True)
  self.assertTrue(compare_batch(output,[[['a','a']],[['eat','tea']]],'json-string-rows','jsonl-v1',args=args,string_structure_id=49))
  self.assertEqual(self.run_source(STRINGS[49],source,args),'[["a","a"]]\n')
  self.assertFalse(compare_batch(output,[[['a','a']],[['eat','tea']]],'json-string-rows','jsonl-v1'))
 def test_fixed_adapter_fail_closed(self):
  for change in ({'specialId':999},{'treeArgs':[0]},{'resultAdapter':'arg0'}):
   with self.assertRaises(ValueError):wrapper({**NODES[142],**change},'class Solution: pass')
  with self.assertRaises(ValueError):result_settings({**STRINGS[49],'stringStructureId':68})
 def test_json_typed_result_preserves_spaces_and_rejects_nonstring(self):
  self.assertEqual(format_result('json-string-array',['',' a ']),'[""," a "]\n')
  for value in ([[1]],[['a',None]],[['a','\ud800']]):
   with self.assertRaises(ValueError):validate_result('json-string-rows',value)

class AdditionalFinalWrappers(FinalProtocolWrappers):
 def test_auxiliary_annotation_and_new_budget(self):
  from batches.selected_final6 import PROBLEMS
  source='''class Solution:
    def findInMountainArray(self, target: int, mountainArr: MountainArray) -> int:
        for _ in range(100): mountainArr.get(0)
        return 0
'''
  self.assertEqual(self.run_source(PROBLEMS[1095],source,[[1,[1,2,1]],[1,[1,2,1]]],True),'0\n0\n')
  interval='''class Solution:
    def employeeFreeTime(self, schedule):
        assert isinstance(schedule[0][0],Interval)
        return [Interval(2,3)]
'''
  self.assertEqual(self.run_source(PROBLEMS[759],interval,[[[[[1,2]],[[3,4]]]]]),'1\n2 2 3\n')
 def test_complex_fresh_instances_and_json_result(self):
  from batches.selected_complex_design1 import PROBLEMS
  source='''class RandomizedSet:
    def __init__(self): self.values=set()
    def insert(self,x):
        before=x not in self.values
        self.values.add(x)
        return before
    def getRandom(self): return min(self.values)
'''
  args=[[['RandomizedSet','insert','getRandom'],[[],[5],[]]]]*2
  output=self.run_source(PROBLEMS[380],source,args,True)
  self.assertEqual(output,'"[null,1,5]"\n"[null,1,5]"\n')
  self.assertTrue(compare_batch(output,['[null,1,5]']*2,'string','jsonl-v1',args=args,checker='design-lc-380',complex_design_id=380))
 def test_float_and_fraction_batch_contract(self):
  self.assertTrue(compare_batch('1.500000001\n',[1.5],'float','jsonl-v1'))
  self.assertFalse(compare_batch('true\n',[1.0],'float','jsonl-v1'))
  self.assertTrue(compare_batch('"0.3(3)"\n',['0.(3)'],'string','jsonl-v1',args=[[1,3]],checker='fraction-lc-166'))
