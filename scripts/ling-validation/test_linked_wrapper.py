"""Synthetic linked wrappers only; no downloaded source or private fixture files."""
import io,json,sys,unittest
from unittest.mock import patch
from generate_batch import wrapper
from linked_codec import ListNode,from_values,to_values
from batches.selected_lists1 import PROBLEMS
class LinkedWrapperTest(unittest.TestCase):
 def execute(self,pid,source,cases,batch=False):
  spec=PROBLEMS[pid];program=wrapper(spec,source);stdin=json.dumps(cases) if batch else spec['encode'](cases[0]);out=io.StringIO();limit=sys.getrecursionlimit()
  try:
   with patch.object(sys,'stdin',io.StringIO(stdin)),patch.object(sys,'stdout',out),patch.object(sys,'argv',['authored']+(['--batch'] if batch else [])):exec(program,{'__name__':'__main__'})
  finally:sys.setrecursionlimit(limit)
  return out.getvalue()
 def test_single_list_and_empty_batch_are_independent(self):
  code='''class Solution:
 def reverseList(self,head: ListNode):
  prev=None
  while head:
   nxt=head.next;head.next=prev;prev=head;head=nxt
  return prev
'''
  cases=[[[1,2,2]], [[]]]
  self.assertEqual(self.execute(206,code,cases),'3\n2 2 1\n')
  self.assertEqual(self.execute(206,code,cases,True),'[2, 2, 1]\n[]\n')
  self.assertEqual(cases,[[[1,2,2]],[[]]])
 def test_two_lists_remain_distinct_even_with_equal_values(self):
  code='''class Solution:
 def mergeTwoLists(self,a: ListNode,b: ListNode):
  if a is not None and b is not None:assert a is not b
  if a is None:return b
  node=a
  while node.next:node=node.next
  node.next=b
  return a
'''
  cases=[[[1],[1]], [[],[2]], [[],[]]]
  self.assertEqual(self.execute(21,code,cases),'2\n1 1\n')
  self.assertEqual(self.execute(21,code,cases,True),'[1, 1]\n[2]\n[]\n')
 def test_array_of_lists_preserves_empty_members(self):
  code='''class Solution:
 def mergeKLists(self,lists):
  dummy=tail=ListNode()
  for head in lists:
   assert head is None or isinstance(head,ListNode)
   if head is not None:
    tail.next=head
    while tail.next:tail=tail.next
  return dummy.next
'''
  cases=[[[[],[1,1],[],[2]]],[[]],[[[]]]]
  self.assertEqual(self.execute(23,code,cases),'3\n1 1 2\n')
  self.assertEqual(self.execute(23,code,cases,True),'[1, 1, 2]\n[]\n[]\n')
 def test_inplace_arg0_and_integer_result(self):
  reorder='''class Solution:
 def reorderList(self,head):
  head.val+=10
  return None
'''
  self.assertEqual(self.execute(143,reorder,[[[1,2]]]),'2\n11 2\n')
  self.assertEqual(self.execute(143,reorder,[[[1]],[[2]]],True),'[11]\n[12]\n')
  check='''class Solution:
 def isPalindrome(self,head):
  assert isinstance(head,ListNode)
  return head.next is None
'''
  self.assertEqual(self.execute(234,check,[[[1]]]),'1\n')
  self.assertEqual(self.execute(234,check,[[[1]],[[1,2]]],True),'1\n0\n')
 def test_scalar_tail_and_return_head_replacement(self):
  code='''class Solution:
 def removeElements(self,head,val):
  assert type(val)is int
  return ListNode(val,head)
'''
  self.assertEqual(self.execute(203,code,[[[1],3]]),'2\n3 1\n')
 def test_cyclic_and_noninteger_results_fail_closed(self):
  cycle='''class Solution:
 def reverseList(self,head):
  head.next=head
  return head
'''
  bad='''class Solution:
 def reverseList(self,head):
  return ListNode(True)
'''
  for source in (cycle,bad):
   for batch in (False,True):
    with self.assertRaises(ValueError):self.execute(206,source,[[[1]]],batch)
  self.assertEqual(to_values(from_values([])),[])
  self.assertEqual(to_values(from_values([0,0,-1])),[0,0,-1])
  for value in ([True],[1.0],['1']):
   with self.assertRaises(ValueError):from_values(value)
  with self.assertRaises(ValueError):from_values([1]*100001)
 def test_invalid_adapter_metadata(self):
  for extra in ({'listArgs':[True]},{'listArgs':[-1]},{'listArgs':[0,0]},{'listArgs':[0],'listArrayArgs':[0]},{'resultLinked':'unknown'}):
   with self.assertRaises(ValueError):wrapper({**PROBLEMS[206],**extra},'class Solution: pass')
if __name__=='__main__':unittest.main()
