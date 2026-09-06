"""Original fixture invariants; only authored codecs and mutants execute here."""
import io
import math
import random
import sys
import unittest
from unittest.mock import patch
from .arrays2 import PROBLEMS, validate

class ArraySecondBatchTest(unittest.TestCase):
 def test_known_answers(self):
  expected={1046:1,1217:1,1221:4,1287:6,1323:9969,1332:1,1385:2,1399:4,1422:5,1446:2,1502:1,1512:4,1534:4,1539:9,1588:58,1668:2,1716:10,1742:2,1827:3,1863:6,1869:1,1979:2,1984:2,1991:3,1995:1,2016:4,2027:1,2078:3,2144:5,2154:24}
  self.assertEqual(set(PROBLEMS),set(expected))
  for pid,y in expected.items():
   with self.subTest(pid=pid):self.assertEqual(PROBLEMS[pid]['oracle'](PROBLEMS[pid]['edges'][0]),y)
 def test_domains_and_codec(self):
  for pid,p in PROBLEMS.items():
   rng=random.Random(20260905+pid)
   small=p['edges']+[p['random_args'](rng) for _ in range(120)]
   for args in small+[a for a,_ in p['pressure']]:
    with self.subTest(pid=pid):
     p['validate'](args);scope={'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))):exec(p['parse'],scope)
     self.assertEqual(scope['args'],args)
   for args in small:self.assertIsInstance(p['oracle'](args),int)
 def test_bad_inputs(self):
  invalid={1046:[[]],1217:[[0]],1221:['LLR'],1287:[[1,2]],1323:[123],1332:['abc'],1385:[[1],[2],101],1399:[0],1422:['1'],1446:['A'],1502:[[1]],1512:[[101]],1534:[[1,2],1,1,1],1539:[[2,1],1],1588:[[0]],1668:['a',''],1716:[1001],1742:[20,10],1827:[[0]],1863:[[21]],1869:['x'],1979:[[1]],1984:[[1],2],1991:[[1001]],1995:[[1,2,3]],2016:[[1]],2027:['XX'],2078:[[1,1]],2144:[[0]],2154:[[1],0]}
  for pid,args in invalid.items():
   with self.subTest(pid=pid),self.assertRaises(AssertionError):validate(pid,args)
 def test_source_constraint_boundaries(self):
  validate(1287,[[100000]])
  with self.assertRaises(AssertionError):validate(1287,[[100001]])
  validate(1534,[[0,1000,0],1000,1000,0])
  with self.assertRaises(AssertionError):validate(1534,[[0,1001,0],1000,1000,0])
  with self.assertRaises(AssertionError):validate(1534,[[0,1000,0],1001,1000,0])
  self.assertEqual(PROBLEMS[1534]["oracle"]([[0,1000,0],1000,1000,0]),1)
  self.assertEqual(PROBLEMS[1534]["oracle"]([[0,1000,0],999,1000,0]),0)
  self.assertEqual(PROBLEMS[1534]["oracle"]([[0,0,1000],0,1000,999]),0)
 def test_mutation_witnesses(self):
  for pid,p in PROBLEMS.items():
   killed=False
   for args in p['edges']:
    out=io.StringIO()
    with patch.object(sys,'stdin',io.StringIO(p['encode'](args))),patch.object(sys,'stdout',out):exec(p['mutants'][0]['source'],{})
    if out.getvalue().strip()!=str(p['oracle'](args)):killed=True;break
   self.assertTrue(killed,f'{pid} lacks a mutation witness')
 def test_pressure_formulas(self):
  self.assertEqual(PROBLEMS[1588]['pressure'][0][1],1000*sum(n*(101-n) for n in range(1,101,2)))
  coefficient=sum((-1)**j*math.comb(5,j)*math.comb(22-10*j+4,4) for j in range(3))
  self.assertEqual(PROBLEMS[1742]['pressure'][0][1],coefficient)
  self.assertEqual(PROBLEMS[1995]['pressure'][0][1],math.comb(49,3))
  self.assertEqual(PROBLEMS[1534]['pressure'][0][1],math.comb(100,3))
  self.assertEqual(PROBLEMS[1827]['pressure'][0][1],sum(range(5000)))
  for pid in (1046,1217,1323,1385,1399,1422,1446,1512,1534,1539,1588,1668,1716,1742,1863,1869,1979,1991,1995,2016,2078,2154):
   for args,y in PROBLEMS[pid]['pressure']:
    with self.subTest(pid=pid):self.assertEqual(PROBLEMS[pid]['oracle'](args),y)

if __name__=='__main__':unittest.main()
