"""Portable tests execute authored models only, never downloaded solutions."""
import copy,io,json,random,sys,unittest
from pathlib import Path
from unittest.mock import patch
from . import selected_trees2 as b

class SelectedTreesTwo(unittest.TestCase):
 def test_membership_and_examples(self):
  selected={v['number'] for v in json.loads((Path(__file__).resolve().parents[3]/'lib/content/ling-curated-500.json').read_text())}
  self.assertEqual(len(b.PROBLEMS),16);self.assertTrue(set(b.IDS)<=selected)
  examples={226:[4,7,2,9,6,3,1],617:[3,4,5,5,4,None,7],102:[[3],[9,20],[15,7]],107:[[15,7],[9,20],[3]],103:[[3],[20,9],[15,7]],314:[[4],[9],[3,0,1],[8],[7]],987:[[9],[3,15],[20],[7]],545:[1,2,4,5,6,7,3],105:[3,9,20,None,None,15,7],106:[3,9,20,None,None,15,7],654:[6,3,5,None,2,0,None,None,1],114:[1,None,2,None,3,None,4,None,5,None,6],700:[2,1,3],669:[3,2,None,1],538:[30,36,21,36,35,26,15,None,None,None,33,None,None,None,8],99:[2,1,4,None,None,3]}
  for pid,expected in examples.items():
   with self.subTest(pid=pid):self.assertEqual(b.oracle(pid,b.EDGE[pid][0]),expected)
 def test_small_oracles_and_stdio(self):
  for pid,p in b.PROBLEMS.items():
   rng=random.Random(20260913+pid)
   for a in p['edges']+[p['random_args'](rng) for _ in range(144)]:
    with self.subTest(pid=pid,args=a):
     p['validate'](a);self.assertEqual(p['oracle'](a),b.fast(pid,copy.deepcopy(a)))
     scope={'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(p['encode'](a))):exec(p['parse'],scope)
     self.assertEqual(scope['args'],a)
 def test_pressure(self):
  for pid,p in b.PROBLEMS.items():
   for args,want in p['pressure']:
    with self.subTest(pid=pid):
     p['validate'](args);self.assertEqual(b.fast(pid,copy.deepcopy(args)),want)
     text=str(len(want))+'\n'
     if pid in b.ROWS:text+=''.join(str(len(row))+' '+' '.join(map(str,row))+'\n' for row in want)
     else:text+=' '.join('null' if v is None else str(v) for v in want)+'\n'
     self.assertLessEqual(len(text.encode()),p['outputLimit']*1024)
 def test_two_normal_wrong_answer_witnesses(self):
  for pid,p in b.PROBLEMS.items():
   for mutant in p['mutants']:
    killed=False
    for args in p['edges']:
     output=io.StringIO()
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))),patch.object(sys,'stdout',output):exec(mutant['source'],{})
     tokens=iter(output.getvalue().split());n=int(next(tokens));got=[]
     if pid in b.ROWS:
      for _ in range(n):got.append([int(next(tokens)) for _ in range(int(next(tokens)))])
     else:got=[None if (v:=next(tokens))=='null' else int(v) for _ in range(n)]
     self.assertEqual(list(tokens),[])
     if got!=p['oracle'](args):killed=True;break
    self.assertTrue(killed,f'{pid} {mutant["name"]}')
 def test_invalid_constraints(self):
  bad=[(105,[[1,2,3],[3,1,2]]),(106,[[1,2,3],[3,1,2]]),(654,[[1,1]]),(700,[[1],0]),(669,[[1],2,1]),(538,[[1,2]]),(99,[[2,1,3]]),(99,[[2,3,1,4]]),(226,[[True]]),(987,[[]])]
  for pid,args in bad:
   with self.subTest(pid=pid,args=args),self.assertRaises(AssertionError):b.validate(pid,args)
 def test_vertical_ties_and_boundaries(self):
  args=[[1,2,3,None,9,4]]
  self.assertEqual(b.oracle(314,args),[[2],[1,9,4],[3]])
  self.assertEqual(b.oracle(987,args),[[2],[1,4,9],[3]])
  self.assertEqual(b.oracle(545,[[7]]),[7])
  self.assertEqual(b.oracle(669,[[2,1,3],2,2]),[2])
  self.assertEqual(b.oracle(700,[[2,1,3],4]),[])

if __name__=='__main__':unittest.main()
