"""Regression tests execute authored algorithms only, never downloaded references."""
import copy,io,json,random,sys,unittest
from pathlib import Path
from unittest.mock import patch
from . import selected_dp2 as batch

class SelectedDpTwo(unittest.TestCase):
 def test_samples_and_membership(self):
  selected={v['number'] for v in json.loads((Path(__file__).resolve().parents[3]/'lib/content/ling-curated-500.json').read_text())}
  self.assertEqual(len(batch.PROBLEMS),30);self.assertTrue(set(batch.PROBLEMS)<=selected)
  known={227:7,772:21,726:'K4N2O14S4',496:[-1,3,-1],503:[2,-1,2],84:10,85:6,907:17,2104:4,456:1,962:4,402:'1219',316:'acdb',735:[5,10],946:1,921:1,1190:'iloveu',215:5,1834:[0,2,3,1],2402:0,239:[3,3,5,5,6,7],862:3,134:3,135:5,1029:110,1338:2,621:8,881:3,948:2,945:6}
  for pid,p in batch.PROBLEMS.items():
   with self.subTest(pid=pid):self.assertEqual(p['oracle'](p['edges'][0]),known[pid])
 def test_oracles_random_and_codec(self):
  for pid,p in batch.PROBLEMS.items():
   rng=random.Random(20260909+pid)
   for a in p['edges']+[p['random_args'](rng) for _ in range(120)]:
    with self.subTest(pid=pid,args=a):
     p['validate'](a);scope={'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(p['encode'](a))):exec(p['parse'],scope)
     self.assertEqual(scope['args'],a);want=p['oracle'](a);self.assertEqual(batch.variant(pid,copy.deepcopy(a)),want)
     self.assertIs(type(want),list if pid in batch.ARRAY_RESULTS else str if pid in batch.STRING_RESULTS else int)
 def test_pressure(self):
  for pid,p in batch.PROBLEMS.items():
   for a,want in p['pressure']:
    with self.subTest(pid=pid):
     p['validate'](a);scope={'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(p['encode'](a))):exec(p['parse'],scope)
     self.assertEqual(scope['args'],a);self.assertEqual(batch.variant(pid,copy.deepcopy(a)),want)
     text=str(len(want))+'\n'+' '.join(map(str,want))+'\n' if isinstance(want,list) else str(want)+'\n'
     self.assertLessEqual(len(text.encode()),p['outputLimit']*1024)
 def test_wrong_algorithm_witnesses(self):
  for pid,p in batch.PROBLEMS.items():
   for mutant in p['mutants']:
    killed=False
    for a,want in [(a,p['oracle'](a)) for a in p['edges']]+(p['pressure'] if pid==907 else []):
     out=io.StringIO()
     with patch.object(sys,'stdin',io.StringIO(p['encode'](a))),patch.object(sys,'stdout',out):exec(mutant['source'],{})
     if pid in batch.ARRAY_RESULTS:
      values=list(map(int,out.getvalue().split()));self.assertEqual(values[0],len(values)-1);got=values[1:]
     else:got=out.getvalue()[:-1] if pid in batch.STRING_RESULTS else int(out.getvalue())
     if got!=want:killed=True;break
    self.assertTrue(killed,f'{pid} {mutant["name"]}')
 def test_unique_increment_signed_answer_promise(self):
  for n in (65537,100000):
   with self.subTest(n=n),self.assertRaises(AssertionError):batch.validate(945,[[100000]*n])
  batch.validate(945,[[100000]*65536])
  args,expected=batch.PROBLEMS[945]['pressure'][0]
  self.assertEqual(len(args[0]),100000)
  self.assertEqual(expected,1249975000)
  # Occupied slots 0..49999 absorb the duplicate zeros, with no interaction
  # with the already distinct suffix starting at 50000.
  self.assertEqual(expected,sum(range(50000)))
 def test_invalid_domains(self):
  bad={227:['1/0'],772:['(1+2'],726:['H1'],496:[[1],[2]],503:[[]],84:[[-1]],85:[[['2']]],907:[[0]],2104:[[10**9+1]],456:[[]],962:[[1]],402:['01',1],316:['A'],735:[[0,1]],946:[[1,1],[1,1]],921:['a'],1190:[')('],215:[[1],0],1834:[[[0,1]]],2402:[2,[[1,2],[1,3]]],239:[[1],2],862:[[1],0],134:[[1,1],[1,1]],135:[[-1]],1029:[[[1,2]]],1338:[[1]],621:[['a'],1],881:[[4],3],948:[[10000],0],945:[[-1]]}
  for pid,a in bad.items():
   with self.subTest(pid=pid),self.assertRaises(AssertionError):batch.validate(pid,a)
  for pid,a in [(726,['(H2)2147483647']),(227,['2147483647+1']),(772,['3/(2-2)'])]:
   with self.assertRaises(AssertionError):batch.validate(pid,a)

if __name__=='__main__':unittest.main()
