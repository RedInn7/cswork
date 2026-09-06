"""Third batch regressions, independent from any downloaded solution."""
import io
import random
import sys
import unittest
from unittest.mock import patch
from .arrays3 import PROBLEMS,validate

class ArrayThirdBatchTest(unittest.TestCase):
 def test_known_answers(self):
  known={2176:4,2269:2,2367:2,2379:3,2423:1,2441:3,2506:2,2529:3,2540:2,2558:29,2696:2,2748:5,2760:3,2765:4,2784:1,2815:88,2824:3,2848:7,2960:3,2980:1,3010:6,3090:4,3105:2,3258:12,3354:2,3364:1,3375:2,3396:2,3427:11,3432:4}
  self.assertEqual(set(known),set(PROBLEMS))
  for pid,want in known.items():
   with self.subTest(pid=pid):self.assertEqual(PROBLEMS[pid]['oracle'](PROBLEMS[pid]['edges'][0]),want)
 def test_constraints_and_codec(self):
  for pid,p in PROBLEMS.items():
   rng=random.Random(20260905+pid);small=p['edges']+[p['random_args'](rng) for _ in range(120)]
   for args in small+[a for a,_ in p['pressure']]:
    with self.subTest(pid=pid):
     p['validate'](args);context={'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))):exec(p['parse'],context)
     self.assertEqual(context['args'],args)
   for args in small:self.assertIsInstance(p['oracle'](args),int)
 def test_invalid_domains(self):
  bad={2176:[[1],0],2269:[100,4],2367:[[1,1,2],1],2379:['W',2],2423:['a'],2441:[[0]],2506:[['A']],2529:[[2,1]],2540:[[1],[0]],2558:[[1],0],2696:['ab'],2748:[[10,11]],2760:[[1],0],2765:[[1]],2784:[[201]],2815:[[1]],2824:[[1],51],2848:[[[2,1]]],2960:[[-1]],2980:[[2]],3010:[[1,2]],3090:['a'],3105:[[51]],3258:['01',0],3354:[[1]],3364:[[1],2,1],3375:[[1],0],3396:[[101]],3427:[[0]],3432:[[1]]}
  for pid,args in bad.items():
   with self.subTest(pid=pid),self.assertRaises(AssertionError):validate(pid,args)
 def test_every_mutant_has_explicit_counterexample(self):
  for pid,p in PROBLEMS.items():
   killed=False
   for args in p['edges']:
    out=io.StringIO()
    with patch.object(sys,'stdin',io.StringIO(p['encode'](args))),patch.object(sys,'stdout',out):exec(p['mutants'][0]['source'],{})
    if out.getvalue().strip()!=str(p['oracle'](args)):killed=True;break
   self.assertTrue(killed,f'{pid} lacks a wrong-answer witness')
 def test_pressure_answers(self):
  for pid,p in PROBLEMS.items():
   for args,expected in p['pressure']:
    with self.subTest(pid=pid):
     if pid==2540:answer=min(set(args[0])&set(args[1]),default=-1)
     elif pid==2980:answer=int(sum(x%2==0 for x in args[0])>=2)
     else:answer=p['oracle'](args)
     self.assertEqual(answer,expected)
 def test_simulation_matches_independent_prefix_balance_law(self):
  p=PROBLEMS[3354];rng=random.Random(3354)
  for _ in range(120):
   args=p['random_args'](rng);a=args[0]
   answer=sum(2 if sum(a[:i])==sum(a[i+1:]) else 1 if abs(sum(a[:i])-sum(a[i+1:]))==1 else 0 for i,x in enumerate(a) if x==0)
   self.assertEqual(p['oracle'](args),answer)

if __name__=='__main__':unittest.main()
