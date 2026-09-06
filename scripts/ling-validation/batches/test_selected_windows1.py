import io
import random
import sys
import unittest
from unittest.mock import patch
from batches.selected_windows1 import PROBLEMS, fast, oracle, validate, minimum_window

class SelectedWindowsTest(unittest.TestCase):
 def test_independent_small_oracles_and_codecs(self):
  self.assertEqual(len(PROBLEMS),30)
  for pid,p in PROBLEMS.items():
   rng=random.Random(20260908+pid)
   for args in p['edges']+[p['random_args'](rng) for _ in range(120)]:
    with self.subTest(pid=pid,args=args):
     p['validate'](args)
     self.assertEqual(p['oracle'](args),fast(pid,args))
     scope={'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))):exec(p['parse'],scope)
     self.assertEqual(scope['args'],args)
 def test_pressure_formulas_and_codec(self):
  for pid,p in PROBLEMS.items():
   self.assertLessEqual(len(p['edges'])+24+len(p['pressure']),64)
   for args,want in p['pressure']:
    with self.subTest(pid=pid):
     p['validate'](args);self.assertEqual(fast(pid,args),want)
     scope={'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))):exec(p['parse'],scope)
     self.assertEqual(scope['args'],args)
     output=str(want)+'\n' if p['resultKind']!='integer-set' else str(len(want))+'\n'+' '.join(map(str,want))+'\n'
     self.assertLessEqual(len(output.encode()),p['outputLimit']*1024)
 def test_each_mutant_has_a_small_witness(self):
  for pid,p in PROBLEMS.items():
   self.assertEqual(len(p['mutants']),2)
   for mutant in p['mutants']:
    killed=False
    for args in p['edges']:
     output=io.StringIO()
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))),patch.object(sys,'stdout',output):exec(mutant['source'],{})
     text=output.getvalue()
     if p['resultKind']=='string':actual=text[:-1]
     elif p['resultKind']=='integer-set':
      nums=list(map(int,text.split()));self.assertEqual(nums[0],len(nums)-1);actual=sorted(nums[1:])
     else:actual=int(text)
     if actual!=p['oracle'](args):killed=True;break
    with self.subTest(pid=pid,mutant=mutant['name']):self.assertTrue(killed)
 def test_constraints_and_unique_minimum(self):
  bad={42:[[100001]],567:['A','abc'],1052:[[1],[0],0],159:['1'],340:['abc',51],904:[[1]],424:['abc',0],1493:[[2]],1208:['a','bb',1],713:[[0],5],76:['abxxab','ab'],30:['abc',['a','bb']],395:['a',0],992:[[2],1],1658:[[1],0],1838:[[1],0],1234:['QWE'],1358:['ab'],1438:[[1],-1],2024:['T',0],2516:['a',2],2302:[[0],1],2537:[[1],0],560:[[1001],0],525:[[2]],523:[[10**9]*3,2],974:[[0],1],930:[[0],2],1248:[[0],1],1423:[[1],2]}
  for pid,args in bad.items():
   with self.subTest(pid=pid),self.assertRaises(AssertionError):validate(pid,args)
  self.assertEqual(minimum_window('ADOBECODEBANC','ABC'),('BANC',1))
  self.assertEqual(oracle(76,['a','aa']),'')
  self.assertEqual(oracle(30,['aaaaaa',['aa','aa']]),[0,1,2])

if __name__=='__main__':unittest.main()
