"""Enumeration regression tests use authored algorithms and tracked membership."""
import copy,io,json,random,sys,unittest
from pathlib import Path
from unittest.mock import patch
from . import selected_enumeration1 as b

class EnumerationOne(unittest.TestCase):
 def test_membership_examples(self):
  selected={v['number'] for v in json.loads((Path(__file__).resolve().parents[3]/'lib/content/ling-curated-500.json').read_text())}
  self.assertEqual(len(b.IDS),16);self.assertTrue(set(b.IDS)<=selected)
  known={15:[[-1,-1,2],[-1,0,1]],18:[[-2,-1,1,2],[-2,0,0,2],[-1,0,0,1]],78:[[],[1],[2],[3],[1,2],[1,3],[2,3],[1,2,3]],77:[[1,2],[1,3],[1,4],[2,3],[2,4],[3,4]],46:[[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]],90:[[],[1],[2],[1,2],[2,2],[1,2,2]],47:[[1,1,2],[1,2,1],[2,1,1]],39:[[2,2,3],[7]],40:[[1,1,6],[1,2,5],[1,7],[2,6]],216:[[1,2,4]],491:[[4,6],[4,7],[4,6,7],[4,6,7,7],[4,7,7],[6,7],[6,7,7],[7,7]],254:[[2,6],[2,2,3],[3,4]],113:[[5,4,11,2],[5,8,4,5]],417:[[0,4],[1,3],[1,4],[2,2],[3,0],[3,1],[4,0]],336:[[0,1],[1,0],[3,2],[2,4]],1192:[[1,3]]}
  for pid,want in known.items():
   with self.subTest(pid=pid):self.assertEqual(b.normalize(pid,b.oracle(pid,b.EDGE[pid][0])),b.normalize(pid,want))
 def test_oracles_random_and_stdio(self):
  for pid,p in b.PROBLEMS.items():
   r=random.Random(20260915+pid)
   for args in p['edges']+[p['random_args'](r) for _ in range(144)]:
    with self.subTest(pid=pid,args=args):
     p['validate'](args);want=p['oracle'](args);self.assertEqual(b.normalize(pid,want),b.normalize(pid,b.fast(pid,copy.deepcopy(args))))
     if pid!=113:self.assertEqual(len(want),len(set(b.normalize(pid,want))))
     scope={'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))):exec(p['parse'],scope)
     self.assertEqual(scope['args'],args)
 def test_pressure_and_byte_limits(self):
  for pid,p in b.PROBLEMS.items():
   for args,want in p['pressure']:
    with self.subTest(pid=pid):
     p['validate'](args);self.assertEqual(b.normalize(pid,b.fast(pid,copy.deepcopy(args))),b.normalize(pid,want))
     size=len(str(len(want)))+1+sum(len(str(len(row)))+1+sum(1+len(str(v)) for v in row) for row in want)
     self.assertLessEqual(size,p['outputLimit']*1024)
     if pid!=113:self.assertEqual(len(want),len(set(b.normalize(pid,want))))
 def test_two_well_formed_wrong_answers(self):
  for pid,p in b.PROBLEMS.items():
   for mutant in p['mutants']:
    killed=False
    for args in p['edges']:
     output=io.StringIO()
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))),patch.object(sys,'stdout',output):exec(mutant['source'],{})
     tokens=iter(map(int,output.getvalue().split()));n=next(tokens);got=[[next(tokens) for _ in range(next(tokens))] for _ in range(n)];self.assertEqual(list(tokens),[])
     if b.normalize(pid,got)!=b.normalize(pid,p['oracle'](args)):killed=True;break
    self.assertTrue(killed,f'{pid} {mutant["name"]}')
 def test_original_promises(self):
  bad=[(15,[[1,2]]),(18,[[10**9+1],0]),(78,[[1,1]]),(77,[20,21]),(46,[[1,1]]),(90,[[11]]),(47,[list(range(9))]),(39,[list(range(2,32)),40]),(40,[[1],31]),(216,[1,1]),(491,[[101]]),(254,[10000001]),(113,[[],1001]),(417,[[[100001]]]),(336,[['a','a']]),(1192,[4,[[0,1],[1,2],[2,0]]]),(1192,[3,[[0,1],[1,0],[1,2]]])]
  for pid,args in bad:
   with self.subTest(pid=pid),self.assertRaises(AssertionError):b.validate(pid,args)
 def test_duplicate_paths_and_empty_member(self):
  self.assertEqual(b.PROBLEMS[113]['resultKind'],'integer-row-multiset')
  self.assertEqual(b.oracle(113,[[1,2,2],3]),[[1,2],[1,2]])
  self.assertIn([],b.oracle(78,[[1]]))
  self.assertEqual(b.oracle(254,[1]),[])
  self.assertEqual(b.normalize(336,b.oracle(336,[['','a']])),[(0,1),(1,0)])
  self.assertEqual(b.combo_count(list(range(11,41)),40),19)

if __name__=='__main__':unittest.main()
