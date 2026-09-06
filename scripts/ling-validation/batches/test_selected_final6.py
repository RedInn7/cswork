import unittest,random,json,sys,io,copy
from unittest.mock import patch
from fractions import Fraction
from batches.selected_final6 import PROBLEMS,oracle,fraction_oracle
from float_checkers import matches_floats
from fraction_checker import matches_fraction
from auxiliary_codec import MountainArray,Interval,prepare_args,prepare_result

class FinalSixTests(unittest.TestCase):
 def test_samples(self):
  expected={4:2.0,857:105.0,399:[6.0,0.5,-1.0,1.0,-1.0],166:'0.5',1095:2,759:[[3,4]]}
  self.assertEqual(set(PROBLEMS),set(expected))
  for pid,p in PROBLEMS.items():self.assertEqual(p['oracle'](p['edges'][0]),expected[pid])
 def test_120_oracles_and_codecs_per_problem(self):
  for pid,p in PROBLEMS.items():
   rng=random.Random(20260906+pid)
   for args in p['edges']+[p['random_args'](rng) for _ in range(120)]:
    with self.subTest(pid=pid,args=args):
     p['validate'](args);expected=p['oracle'](args);scope={'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))):exec(p['parse'],scope)
     self.assertEqual(scope['args'],args)
     if pid==166:self.assertTrue(matches_fraction(expected,p['encode'](args)))
     elif pid in (4,857):self.assertIs(type(expected),float)
     elif pid==1095:self.assertIs(type(expected),int)
     else:self.assertIs(type(expected),list)
 def test_pressure_domain_and_independent_answers(self):
  for pid,p in PROBLEMS.items():
   self.assertLessEqual(24+len(p['edges'])+len(p['pressure']),64)
   for args,want in p['pressure']:
    p['validate'](args)
    if pid in (4,399,1095,166):self.assertEqual(p['oracle'](args),want)
    if pid==166:self.assertTrue(matches_fraction(want,p['encode'](args)))
    if pid==857:self.assertEqual(want,args[2]*args[1][0])
    if pid==759:
     # Endpoint sweep (different from the brute oracle's per-cell scan).
     events={}
     for employee in args[0]:
      for start,end in employee:events[start]=events.get(start,0)+1;events[end]=events.get(end,0)-1
     points=sorted(events);busy=0;answer=[]
     for i,x in enumerate(points[:-1]):
      busy+=events[x]
      if not busy:answer.append([x,points[i+1]])
     self.assertEqual(answer,want)
 def test_two_clean_wrong_algorithm_witnesses(self):
  for pid,p in PROBLEMS.items():
   for mutant in p['mutants']:
    killed=False
    for args in p['edges']:
     output=io.StringIO()
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))),patch.object(sys,'stdout',output):exec(mutant['source'],{})
     actual=output.getvalue();expected=p['oracle'](args)
     if pid in (4,857):passed=matches_floats(actual,str(expected))
     elif pid==399:passed=matches_floats(actual,str(len(expected))+'\n'+' '.join(map(str,expected)),True)
     elif pid==166:passed=matches_fraction(actual,p['encode'](args))
     elif pid==1095:passed=int(actual)==expected
     else:
      values=iter(map(int,actual.split()));n=next(values);rows=[[next(values) for _ in range(next(values))] for _ in range(n)];self.assertIsNone(next(values,None));passed=rows==expected
     if not passed:killed=True;break
    self.assertTrue(killed,(pid,mutant['name']))
 def test_fixed_auxiliary_and_invalid_constraints(self):
  m=MountainArray([1,3,2]);self.assertEqual(m.length(),3)
  for _ in range(100):self.assertEqual(m.get(1),3)
  with self.assertRaises(ValueError):m.get(1)
  for invalid in (-1,3,True,1.0):
   with self.assertRaises(ValueError):MountainArray([1,3,2]).get(invalid)
  self.assertEqual(prepare_args(1095,[2,[1,3,2]])[1].get(2),2)
  schedule=prepare_args(759,[[[[1,2],[3,4]],[[0,5]]]])[0]
  self.assertIsInstance(schedule[0][0],Interval)
  self.assertEqual(prepare_result(759,[Interval(2,3)]),[[2,3]])
  for result in ([Interval(2,2)],[Interval(True,3)],[[2,3]]):
   with self.assertRaises(ValueError):prepare_result(759,result)
  for pid,args in [(4,[[],[]]),(4,[[2,1],[]]),(857,[[1],[0],1]),(399,[[['a','b'],['a','b']],[2.,3.],[['a','b']]]),(166,[1,0]),(1095,[0,[1,2,3]]),(759,[[[[1,3],[2,4]]]])]:
   with self.subTest(pid=pid),self.assertRaises((ValueError,AssertionError)):PROBLEMS[pid]['validate'](args)
  for pid in (5,0,None):
   with self.assertRaises(ValueError):prepare_args(pid,[])

if __name__=='__main__':unittest.main()
