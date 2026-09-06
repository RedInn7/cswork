"""Authored-code checks only: no downloaded implementation is loaded or executed."""
import contextlib
import io
import itertools
import random
import sys
import unittest
from functools import lru_cache
from unittest.mock import patch
from batches.dp2 import PROBLEMS,oracle,tiling_count

SAMPLES={45:2,55:1,97:1,122:7,123:6,139:1,188:2,264:12,309:3,486:0,516:4,647:3,714:8,740:6,790:5,918:3,931:13,983:11,1014:11,1035:2,1043:84,1130:32,1140:10,1186:4,1191:9,1262:18,1277:15,1289:13,1690:6,1937:9}
INVALID={45:[[0,1]],55:[[100001]],97:['a'*101,'',''],122:[[10001]],123:[[100001]],139:['a',['a','a']],188:[101,[1]],264:[1691],309:[[1001]],486:[[10000001]],516:[''],647:['A'],714:[[0],0],740:[[0]],790:[1001],918:[[30001]],931:[[[101]]],983:[[2,1],[1,2,3]],1014:[[1]],1035:[[2001],[1]],1043:[[1000000000]*3,3],1130:[[16,1]],1140:[[0]],1186:[[-10001]],1191:[[1],100001],1262:[[0]],1277:[[[2]]],1289:[[[100]]],1690:[[1]],1937:[[[100001]]]}

class DP2BatchTests(unittest.TestCase):
 def test_samples_randoms_constraints_and_codec(self):
  self.assertEqual(set(SAMPLES),set(PROBLEMS))
  for pid,p in PROBLEMS.items():
   with self.subTest(pid=pid):
    self.assertEqual(p['oracle'](p['edges'][0]),SAMPLES[pid])
    rng=random.Random(20260906+pid)
    small=p['edges']+[p['random_args'](rng) for _ in range(144)]
    for a in small+[a for a,e in p['pressure']]:
     self.assertTrue(p['validate'](a));ns={'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(p['encode'](a))):exec(p['parse'],ns)
     self.assertEqual(ns['args'],a)
    for a in small:self.assertIs(type(p['oracle'](a)),int)
    self.assertLessEqual(len(p['edges'])+24+len(p['pressure']),64)

 def test_each_mutant_has_a_clean_wrong_answer(self):
  for pid,p in PROBLEMS.items():
   for mutant in p['mutants']:
    with self.subTest(pid=pid):
     rejected=False
     for a in p['edges']:
      out=io.StringIO()
      with patch.object(sys,'stdin',io.StringIO(p['encode'](a))),contextlib.redirect_stdout(out):exec(mutant['source'],{})
      if int(out.getvalue())!=p['oracle'](a):rejected=True;break
     self.assertTrue(rejected)

 def test_readme_constraints_reject_illegal_inputs(self):
  self.assertEqual(set(INVALID),set(PROBLEMS))
  for pid,a in INVALID.items():
   with self.subTest(pid=pid),self.assertRaises(AssertionError):PROBLEMS[pid]['validate'](a)

 def test_constructed_pressure_answers(self):
  # Independent construction: enumerate all allowed prime-exponent triples.
  ugly=sorted({2**i*3**j*5**k for i in range(31) for j in range(20) for k in range(14) if 2**i*3**j*5**k<=2147483647})
  for a,e in PROBLEMS[264]['pressure']:self.assertEqual(ugly[a[0]-1],e)
  for n in range(1,7):self.assertEqual(oracle(790,[n]),tiling_count(n))
  # Uniform piles reduce to a finite game on remaining count and M.
  @lru_cache(None)
  def uniform(n,m):return max((n-uniform(n-k,max(m,k)) for k in range(1,min(n,2*m)+1)),default=0)
  self.assertEqual(uniform(100,1),50)
  for n in range(2,10):self.assertEqual(oracle(1690,[[1]*n]),n//2)

if __name__=='__main__':unittest.main()
