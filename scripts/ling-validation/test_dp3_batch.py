"""Third DP batch tests run only authored code, never downloaded solutions."""
import contextlib
import io
import random
import sys
import unittest
from unittest.mock import patch
from batches import dp3

SAMPLES={32:2,115:3,132:1,233:6,397:3,413:3,446:7,467:6,552:8,576:6,600:5,639:9,698:1,718:3,801:1,935:10,940:7,1027:4,1105:6,1155:6,1218:4,1220:5,1269:4,1411:12,1416:1,1547:16,1641:15,1653:2,2320:4,2466:8}
INVALID={32:['a'],115:['a'*34,'a'*17],132:[''],233:[10**9+1],397:[0],413:[[1001]],446:[[0]*32],467:['A'],552:[0],576:[1,1,1,1,0],600:[0],639:['x'],698:[[1]*5,1],718:[[101],[1]],801:[[2,1],[2,1]],935:[5001],940:[''],1027:[[1]],1105:[[[2,1]],1],1155:[1,31,1],1218:[[1],10001],1220:[20001],1269:[0,1],1411:[5001],1416:['01',9],1547:[3,[1,1]],1641:[51],1653:['c'],2320:[10001],2466:[2,1,1,1]}

class DP3BatchTests(unittest.TestCase):
 def test_samples_random_domain_and_codec(self):
  self.assertEqual(set(SAMPLES),set(dp3.PROBLEMS))
  for pid,p in dp3.PROBLEMS.items():
   with self.subTest(pid=pid):
    self.assertEqual(p['oracle'](p['edges'][0]),SAMPLES[pid])
    r=random.Random(20260906+pid)
    small=p['edges']+[p['random_args'](r) for _ in range(144)]
    for a in small+[a for a,e in p['pressure']]:
     self.assertTrue(p['validate'](a));ns={'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(p['encode'](a))):exec(p['parse'],ns)
     self.assertEqual(ns['args'],a)
    for a in small:self.assertIs(type(p['oracle'](a)),int)
    self.assertLessEqual(len(p['edges'])+24+len(p['pressure']),64)

 def test_each_incorrect_algorithm_has_a_clean_wrong_answer(self):
  for pid,p in dp3.PROBLEMS.items():
   for mutant in p['mutants']:
    with self.subTest(pid=pid):
     wrong=False
     for a in p['edges']:
      out=io.StringIO()
      with patch.object(sys,'stdin',io.StringIO(p['encode'](a))),contextlib.redirect_stdout(out):exec(mutant['source'],{})
      if int(out.getvalue())!=p['oracle'](a):wrong=True;break
     self.assertTrue(wrong)

 def test_source_constraints_reject_invalid_inputs(self):
  self.assertEqual(set(INVALID),set(dp3.PROBLEMS))
  for pid,a in INVALID.items():
   with self.subTest(pid=pid),self.assertRaises(AssertionError):dp3.PROBLEMS[pid]['validate'](a)

 def test_pressure_counting_models_agree_with_exhaustive_small_oracles(self):
  for n in range(1,6):
   self.assertEqual(dp3.attendance(n),dp3.oracle(552,[n]))
   self.assertEqual(dp3.wildcard_count(n),dp3.oracle(639,['*'*n]))
   self.assertEqual(dp3.houses(n),dp3.oracle(2320,[n]))
   self.assertEqual(dp3.transfer(n,'aeiou',lambda u,v:v in dp3.VOWELS[u]),dp3.oracle(1220,[n]))
   self.assertEqual(dp3.transfer(n,range(10),lambda u,v:v in dp3.KNIGHT[u]),dp3.oracle(935,[n]))
  for n in range(1,4):self.assertEqual(dp3.transfer(n,dp3.COLOR_ROWS,lambda u,v:all(a!=b for a,b in zip(u,v))),dp3.oracle(1411,[n]))
  for moves in range(5):self.assertEqual(dp3.exit_count(3,3,moves,1,1),dp3.oracle(576,[3,3,moves,1,1]))

if __name__=='__main__':unittest.main()
