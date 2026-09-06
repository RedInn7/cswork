import io
import random
import sys
import unittest
from unittest.mock import patch
from batches.selected_graphs1 import PROBLEMS,validate,oracle,components,adjacency

class SelectedGraphsTest(unittest.TestCase):
 def test_examples(self):
  expected={329:4,934:1,490:0,505:-1,1293:4,323:2,261:1,684:[2,3],1319:1,785:1,886:1,2101:2,1466:3,2359:2,802:[2,4,5,6],1136:2,127:5,433:1,752:6,773:1,909:1,815:2,743:2,787:700,1631:2,778:3,847:4,1584:20,1168:3,310:[1]}
  self.assertEqual(set(expected),set(PROBLEMS))
  for pid,want in expected.items():
   with self.subTest(pid=pid):self.assertEqual(PROBLEMS[pid]['oracle'](PROBLEMS[pid]['edges'][0]),want)
 def test_120_small_oracles_constraints_and_stdio(self):
  for pid,p in PROBLEMS.items():
   rng=random.Random(20260908+pid)
   for args in p['edges']+[p['random_args'](rng) for _ in range(120)]:
    with self.subTest(pid=pid,args=args):
     p['validate'](args);answer=p['oracle'](args)
     self.assertIs(type(answer),int if p['resultKind']=='integer' else list)
     if isinstance(answer,list):self.assertEqual(len(answer),len(set(answer)))
     scope={'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))):exec(p['parse'],scope)
     self.assertEqual(scope['args'],args)
 def test_pressure_constraints_and_closed_form_invariants(self):
  for pid,p in PROBLEMS.items():
   self.assertLessEqual(24+len(p['edges'])+len(p['pressure']),64)
   for args,want in p['pressure']:
    with self.subTest(pid=pid):
     p['validate'](args);scope={'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))):exec(p['parse'],scope)
     self.assertEqual(scope['args'],args)
     self.assertLessEqual(len(p['encode'](args).encode()),4*1024*1024)
     self.assertLessEqual(len(str(want).encode()),64*1024)
  # Independent combinatorial/graph invariants on maximum-size constructions.
  n=100000;self.assertEqual(PROBLEMS[1319]['pressure'][0][1],components(n,PROBLEMS[1319]['pressure'][0][0][1])-1)
  for args,want in PROBLEMS[323]['pressure']:self.assertEqual(components(*args),want)
  self.assertEqual(PROBLEMS[934]['pressure'][0][1],2*(100-1)-1)
  self.assertEqual(PROBLEMS[909]['pressure'][0][1],len(range(1,400,6)))
  self.assertEqual(PROBLEMS[847]['pressure'][1][1],2*(12-1)-2)
  self.assertEqual(PROBLEMS[1168]['pressure'][0][1],100000+9998)
  self.assertEqual(PROBLEMS[1584]['pressure'][0][1],sum(2000 for _ in range(999)))
  for pid in (490,505):
   for args,want in PROBLEMS[pid]['pressure']:
    g,s,t=args;stoppable=all(v in (0,len(g)-1) for v in t)
    expected=int(stoppable) if pid==490 else sum(abs(u-v) for u,v in zip(s,t)) if stoppable else -1
    self.assertEqual(expected,want)
 def test_two_mutant_witnesses(self):
  for pid,p in PROBLEMS.items():
   self.assertEqual(len(p['mutants']),2)
   for mutant in p['mutants']:
    killed=False
    for args in p['edges']:
     output=io.StringIO()
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))),patch.object(sys,'stdout',output):exec(mutant['source'],{})
     values=list(map(int,output.getvalue().split()))
     if p['resultKind']=='integer':self.assertEqual(len(values),1);actual=values[0]
     else:self.assertEqual(values[0],len(values)-1);actual=values[1:]
     if p['resultKind']=='integer-set':actual=sorted(actual)
     expected=p['oracle'](args)
     if p['resultKind']=='integer-set':expected=sorted(expected)
     if actual!=expected:killed=True;break
    with self.subTest(pid=pid,mutant=mutant['name']):self.assertTrue(killed)
 def test_invalid_constraints_and_special_cases(self):
  bad={329:[[[2**31]]],934:[[[1,1],[1,1]]],490:[[[0,0]],[0,0],[0,0]],505:[[[0,1]],[0,0],[0,1]],1293:[[[0]],0],323:[2,[]],261:[2,[[0,1],[1,0]]],684:[[[1,2],[2,3],[3,1]]],1319:[2,[]],785:[[[1],[]]],886:[2,[[2,1]]],2101:[[[0,1,1]]],1466:[3,[[0,1],[1,0]]],2359:[[0,-1],0,1],802:[[[],[]]],1136:[2,[]],127:['a','a',['a']],433:['A','C',[]],752:[['0001'],'0001'],773:[[[1,2,3],[4,5,5]]],909:[[[1,-1],[-1,-1]]],815:[[[1,1]],1,2],743:[[],2,1],787:[2,[[0,1,0]],0,1,0],1631:[[[0]]],778:[[[0,0],[1,2]]],847:[[[1],[],[]]],1584:[[[0,0],[0,0]]],1168:[2,[1,1],[[1,1,1]]],310:[3,[[0,1],[1,0]]]}
  for pid,args in bad.items():
   with self.subTest(pid=pid),self.assertRaises(AssertionError):validate(pid,args)
  self.assertEqual(oracle(433,['AAAAAAAA','AAAAAAAA',[]]),0)
  self.assertEqual(oracle(2359,[[1,0],0,1]),0)
  self.assertEqual(oracle(1168,[2,[10,10],[[1,2,9],[1,2,1]]]),11)

if __name__=='__main__':unittest.main()
