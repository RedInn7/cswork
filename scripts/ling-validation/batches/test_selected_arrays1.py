"""Local tests execute only authored oracle/codecs/mutants, never downloaded code."""
import io,json,itertools,random,sys,unittest
from collections import Counter
from fractions import Fraction
from pathlib import Path
from unittest.mock import patch
from .selected_arrays1 import PROBLEMS,oracle,validate
from result_contract import format_result,compare_output,validate_result,CHECKERS

class SelectedArraysTest(unittest.TestCase):
 def test_membership_and_known_answers(self):
  curated={x['number'] for x in json.loads((Path(__file__).resolve().parents[3]/'lib/content/ling-curated-500.json').read_text())}
  known={20:1,448:[5,6],645:[2,3],287:2,334:1,128:4,454:2,187:['AAAAACCCCC','CCCCCAAAAA'],266:1,1679:2,2342:54,2364:5,1814:2,1010:3,1657:1,554:2,1930:3,2131:6,8:-42,65:1,686:3,275:3,809:1,1750:2,1328:'aaccba',1763:'aAa',214:'aaacecaaa',1870:1,167:[1,2],16:2}
  self.assertEqual(len(PROBLEMS),30)
  for n,p in PROBLEMS.items():
   with self.subTest(n=n):
    self.assertIn(n,curated);self.assertEqual(p['oracle'](p['edges'][0]),known[n])
 def test_cases_codec_oracle_and_limits(self):
  for n,p in PROBLEMS.items():
   rng=random.Random(20260906+n);small=p['edges']+[p['random_args'](rng) for _ in range(120)]
   self.assertLessEqual(len(p['edges'])+24+len(p['pressure']),64)
   for a in small+[a for a,_ in p['pressure']]:
    with self.subTest(n=n):
     p['validate'](a);text=p['encode'](a);self.assertLessEqual(len(text.encode()),4*1024*1024);scope={'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(text)):exec(p['parse'],scope)
     self.assertEqual(scope['args'],a)
   for v in [p['oracle'](a) for a in small]+[v for _,v in p['pressure']]:
    validate_result(p['resultKind'],v);self.assertLessEqual(len(format_result(p['resultKind'],v).encode()),p['outputLimit']*1024)
 def test_two_mutants_fail_cleanly_on_small_witnesses(self):
  for n,p in PROBLEMS.items():
   self.assertEqual(len(p['mutants']),2)
   for mutant in p['mutants']:
    killed=False
    for a in p['edges']:
     output=io.StringIO()
     with patch.object(sys,'stdin',io.StringIO(p['encode'](a))),patch.object(sys,'stdout',output):exec(mutant['source'],{})
     if not compare_output(CHECKERS[p['resultKind']],output.getvalue(),format_result(p['resultKind'],p['oracle'](a))):killed=True;break
    with self.subTest(n=n,mutant=mutant['name']):self.assertTrue(killed)
 def test_boundary_rejections(self):
  bad={20:[''],448:[[0]],645:[[1,2]],287:[[1,1,2,2]],334:[[]],128:[[10**9+1]],454:[[0],[0,0],[0],[0]],187:['N'],266:['A'],1679:[[1],0],2342:[[0]],2364:[[0]],1814:[[-1]],1010:[[501]],1657:['a','A'],554:[[[1],[2]]],1930:['aa'],2131:[['a']],8:['\t1'],65:[' 1'],686:['','a'],275:[[2,1]],809:['A',['a']],1750:['d'],1328:['ab'],1763:['1'],214:['A'],1870:[[1],1.001],167:[[1,1,1],2],16:[[1,1,2,2],4.5]}
  for n,a in bad.items():
   with self.subTest(n=n),self.assertRaises(AssertionError):validate(n,a)
 def test_pressure_proofs(self):
  self.assertEqual(100000*99999//2%1000000007,PROBLEMS[1814]['pressure'][0][1])
  self.assertEqual(60000*59999//2,PROBLEMS[1010]['pressure'][0][1])
  for n in (65,8,1328,1763,275):
   for a,want in PROBLEMS[n]['pressure']:
    if n!=275:self.assertEqual(oracle(n,a),want)
  self.assertEqual(oracle(1870,[[1,1],1.01]),100)
  for nums in itertools.product(range(-2,3),repeat=4):
   for target in (-2,0,2):
    sums={sum(t) for t in itertools.combinations(nums,3)};best=min(abs(s-target) for s in sums);unique=sum(abs(s-target)==best for s in sums)==1
    try:validate(16,[list(nums),target]);accepted=True
    except AssertionError:accepted=False
    self.assertEqual(accepted,unique)

 def test_large_pressure_independent_properties(self):
  for a,want in PROBLEMS[187]['pressure']:
   counts=Counter(a[0][i:i+10] for i in range(len(a[0])-9))
   self.assertEqual(sorted(want),sorted(s for s,n in counts.items() if n>=2))
  for a,want in PROBLEMS[1870]['pressure']:
   dist,hour=a;h=Fraction(str(hour))
   def elapsed(v):return sum((d+v-1)//v for d in dist[:-1])+Fraction(dist[-1],v)
   self.assertLessEqual(elapsed(want),h)
   if want>1:self.assertGreater(elapsed(want-1),h)
  for a,want in PROBLEMS[214]['pressure']:
   self.assertTrue(want.endswith(a[0]));self.assertEqual(want,want[::-1])
   # This input starts with its sole a: the longest palindrome prefix has length 1.
   self.assertEqual(a[0].count('a'),1);self.assertEqual(a[0][0],'a')
   self.assertEqual(len(want),2*len(a[0])-1)
  a,want=PROBLEMS[1930]['pressure'][0]
  # Three complete alphabets already realize every outer/middle letter pair.
  self.assertTrue(a[0].startswith('abcdefghijklmnopqrstuvwxyz'*3))
  self.assertEqual(want,26*26)
  a,want=PROBLEMS[448]['pressure'][0]
  self.assertEqual(set(want),set(range(1,len(a[0])+1))-set(a[0]))
  a,want=PROBLEMS[275]['pressure'][0]
  self.assertGreaterEqual(sum(x>=want for x in a[0]),want)
  self.assertLess(sum(x>=want+1 for x in a[0]),want+1)

if __name__=='__main__':unittest.main()
