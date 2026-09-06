import io
import math
import random
import sys
import unittest
from unittest.mock import patch
from batches.graphs3 import PROBLEMS

class ThirdGraphBatchTest(unittest.TestCase):
 def test_cases_obey_domain_and_stdio(self):
  self.assertEqual(len(PROBLEMS),30)
  for pid,p in PROBLEMS.items():
   small=p['edges']+[p['random_args'](random.Random(pid*1000+i)) for i in range(120)]
   for a in small+[a for a,_ in p['pressure']]:
    with self.subTest(pid=pid):
     p['validate'](a);env={'sys':sys}
     with patch('sys.stdin',io.StringIO(p['encode'](a))):exec(p['parse'],env)
     self.assertEqual(env['args'],a)
   for a in small:self.assertIsInstance(p['oracle'](a),int,pid)
 def test_examples(self):
  expected={223:7,357:1,365:1,390:1,458:0,625:1,1590:1,829:1,858:2,878:2,1015:1,1201:4,1359:1,1387:13,1401:1,1414:1,1806:1,2549:1,2566:99009,2843:9,593:1,611:3,810:0,1131:13,1250:1,1390:32,1573:4,2425:13,2521:4,835:1}
  for pid,y in expected.items():self.assertEqual(PROBLEMS[pid]['oracle'](PROBLEMS[pid]['edges'][0]),y,pid)
 def test_pressure_derivations(self):
  # Independent sieve-free odd-divisor count for consecutive sums of 10^9.
  self.assertEqual(PROBLEMS[829]['pressure'][0][1],10)
  # Reverse-count binary elimination recurrence, independent from small list simulation.
  def last(n):return 1 if n==1 else 2*(n//2+1-last(n//2))
  self.assertEqual(PROBLEMS[390]['pressure'][0][1],last(10**9))
  self.assertEqual(PROBLEMS[357]['pressure'][0][1],1+sum(9*math.prod(range(9,10-k,-1)) for k in range(1,9)))
  for pid in (365,458,625,858,1015,1387,1806,2549,2566,2843):
   for a,y in PROBLEMS[pid]['pressure']:
    self.assertEqual(PROBLEMS[pid]['oracle'](a),y,pid)

if __name__=='__main__':unittest.main()
