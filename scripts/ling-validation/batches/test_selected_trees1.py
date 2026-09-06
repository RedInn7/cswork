import io
import random
import sys
import unittest
from unittest.mock import patch
from tree_codec import from_level_order,to_level_order,valid_tree
from batches.selected_trees1 import PROBLEMS,fast,validate,two_arms,chain,BOUNDS

class SelectedTreeTest(unittest.TestCase):
 def test_small_independent_oracles_and_codec(self):
  self.assertEqual(len(PROBLEMS),27)
  for pid,p in PROBLEMS.items():
   rng=random.Random(20260908+pid)
   for args in p['edges']+[p['random_args'](rng) for _ in range(120)]:
    with self.subTest(pid=pid,args=args):
     p['validate'](args);self.assertEqual(p['oracle'](args),fast(pid,args))
     scope={'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))):exec(p['parse'],scope)
     self.assertEqual(scope['args'],args)
     for i in p['treeArgs']:self.assertEqual(to_level_order(from_level_order(args[i])),args[i])
 def test_true_maximum_pressure(self):
  for pid,p in PROBLEMS.items():
   sizes=[]
   for args,want in p['pressure']:
    with self.subTest(pid=pid):
     p['validate'](args);self.assertEqual(fast(pid,args),want)
     sizes.append(sum(v is not None for v in args[0]))
     scope={'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))):exec(p['parse'],scope)
     self.assertEqual(scope['args'],args)
   self.assertEqual(max(sizes),BOUNDS[pid][1],pid)
   self.assertLessEqual(len(p['edges'])+24+len(p['pressure']),64)
 def test_mutants(self):
  for pid,p in PROBLEMS.items():
   self.assertEqual(len(p['mutants']),2)
   for mutant in p['mutants']:
    killed=False
    for args in p['edges']:
     output=io.StringIO()
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))),patch.object(sys,'stdout',output):exec(mutant['source'],{})
     if p['resultKind']=='integer-array':
      values=list(map(int,output.getvalue().split()));self.assertEqual(values[0],len(values)-1);actual=values[1:]
     else:actual=int(output.getvalue())
     if actual!=p['oracle'](args):killed=True;break
    with self.subTest(pid=pid,mutant=mutant['name']):self.assertTrue(killed)
 def test_transport_and_problem_constraints(self):
  self.assertIsNone(from_level_order([]))
  self.assertEqual(to_level_order(from_level_order([1,None,2,3])),[1,None,2,3])
  for values in ([None],[1,None],[1,None,None,2],[True],[1,2.0]):
   with self.subTest(values=values),self.assertRaises(ValueError):from_level_order(values)
  cases=[(101,[[]]),(222,[[1,None,2]]),(938,[[2,3],1,5]),(230,[[1],2]),(530,[[1]]),(129,[chain(11,0)]),(129,[chain(10,9)]),(662,[two_arms(31)]),(112,[[1],1001]),(1530,[[1],11]),(98,[[2**31]])]
  for pid,args in cases:
   with self.subTest(pid=pid),self.assertRaises(AssertionError):validate(pid,args)
  # A tree may be legal input to the BST validator while violating BST order.
  validate(98,[[5,3,7,None,6]])
  with self.assertRaises(AssertionError):valid_tree([5,3,7,None,6],bst=True)

if __name__=='__main__':unittest.main()
