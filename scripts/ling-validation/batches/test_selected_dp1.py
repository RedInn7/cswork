"""Authored selected DP checks; never imports downloaded reference solutions."""
import copy,io,json,random,sys,unittest
from pathlib import Path
from unittest.mock import patch
from . import selected_dp1 as batch

class SelectedDpOne(unittest.TestCase):
 def test_membership_and_samples(self):
  selected={v['number'] for v in json.loads((Path(__file__).resolve().parents[3]/'lib/content/ling-curated-500.json').read_text())}
  self.assertEqual(len(batch.PROBLEMS),25);self.assertTrue(set(batch.PROBLEMS)<=selected)
  expected={2369:1,1049:1,879:2,691:3,354:3,646:2,1048:4,873:5,1626:34,1671:3,2707:1,1039:13,312:167,1911:7,926:1,2140:5,1235:120,2008:7,1335:7,403:1,1696:7,375:16,150:9,394:'accaccacc',224:23}
  for pid,p in batch.PROBLEMS.items():
   with self.subTest(pid=pid):self.assertEqual(p['oracle'](p['edges'][0]),expected[pid])
 def test_small_oracles_and_codecs(self):
  for pid,p in batch.PROBLEMS.items():
   rng=random.Random(20260908+pid)
   for args in p['edges']+[p['random_args'](rng) for _ in range(120)]:
    with self.subTest(pid=pid,args=args):
     p['validate'](args);scope={'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))):exec(p['parse'],scope)
     self.assertEqual(scope['args'],args)
     want=p['oracle'](args);self.assertIs(type(want),str if pid==394 else int)
     self.assertEqual(batch.extra_variant(pid,copy.deepcopy(args)),want)
 def test_pressure(self):
  for pid,p in batch.PROBLEMS.items():
   for args,want in p['pressure']:
    with self.subTest(pid=pid):
     p['validate'](args);scope={'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))):exec(p['parse'],scope)
     self.assertEqual(scope['args'],args)
     self.assertEqual(batch.extra_variant(pid,copy.deepcopy(args)),want)
     self.assertLessEqual(len((str(want)+'\n').encode()),p['outputLimit']*1024)
 def test_two_clean_wrong_algorithms(self):
  for pid,p in batch.PROBLEMS.items():
   self.assertEqual(len(p['mutants']),2)
   for mutant in p['mutants']:
    killed=False
    for args in p['edges']:
     output=io.StringIO()
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))),patch.object(sys,'stdout',output):exec(mutant['source'],{})
     text=output.getvalue();got=text[:-1] if pid==394 else int(text)
     if got!=p['oracle'](args):killed=True;break
    self.assertTrue(killed,f'{pid}: {mutant["name"]} lacks an edge witness')
 def test_domain_rejection(self):
  bad={2369:[[1]],1049:[[0]],879:[1,0,[0],[1]],691:[['A'],'a'],354:[[[1,0]]],646:[[[1,1]]],1048:[['']],873:[[1,2,2]],1626:[[1],[0]],1671:[[1,2,3]],2707:['a',['a','a']],1039:[[1,2]],312:[[-1]],1911:[[0]],926:['2'],2140:[[[1,0]]],1235:[[2],[1],[1]],2008:[2,[[1,3,1]]],1335:[[1],11],403:[[0,1,1]],1696:[[1],0],375:[201],150:[['1','0','/']],394:['301[a]'],224:['1+-2']}
  for pid,args in bad.items():
   with self.subTest(pid=pid),self.assertRaises(AssertionError):batch.validate(pid,args)
  for args in [['300[300[2[aa]]]'],['3a'],['2[4]']]:
   with self.assertRaises(AssertionError):batch.validate(394,args)
  for s in ['2147483647+1','+1','1 2','(1','1+']:
   with self.assertRaises(AssertionError):batch.validate(224,[s])

if __name__=='__main__':unittest.main()
