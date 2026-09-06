import json,unittest
from complex_design_codec import run_complex_design
from tree_codec import TreeNode

class ComplexCodec(unittest.TestCase):
 def test_bst_constructor_conversion_and_boolean(self):
  class BSTIterator:
   def __init__(self,root):self.root=root
   def hasNext(self):return self.root is not None
   def next(self):v=self.root.val;self.root=None;return v
  raw=run_complex_design(173,{'BSTIterator':BSTIterator},[['BSTIterator','hasNext','next','hasNext'],[[[7]],[],[],[]]])
  self.assertEqual(json.loads(raw),[None,1,7,0])
 def test_roundtrip_text_is_opaque(self):
  class Codec:
   def serialize(self,root):self.root=root;return 'arbitrary: text is not checked'
   def deserialize(self,text):return self.root
  self.assertEqual(json.loads(run_complex_design(297,{'Codec':Codec},[['Codec','roundTrip'],[[],[[1,None,2]]]])),[None,[1,None,2]])
 def test_roundtrip_cycle_rejected(self):
  class Codec:
   def serialize(self,root):return 'x'
   def deserialize(self,text):u=TreeNode(1);u.left=u;return u
  with self.assertRaises(ValueError):run_complex_design(297,{'Codec':Codec},[['Codec','roundTrip'],[[],[[1]]]])
 def test_only_fixed_methods_are_callable(self):
  class RandomizedSet:pass
  with self.assertRaises(ValueError):run_complex_design(380,{'RandomizedSet':RandomizedSet},[['RandomizedSet','__dict__'],[[],[]]])

if __name__=='__main__':unittest.main()
