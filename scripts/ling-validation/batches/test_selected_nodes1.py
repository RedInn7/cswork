"""Identity fixtures use authored index models and tracked membership only."""
import copy,io,json,random,sys,unittest
from pathlib import Path
from unittest.mock import patch
from . import selected_nodes1 as b

class SelectedNodesOne(unittest.TestCase):
 def test_membership_and_examples(self):
  selected={v['number'] for v in json.loads((Path(__file__).resolve().parents[3]/'lib/content/ling-curated-500.json').read_text())}
  self.assertEqual(len(b.IDS),18);self.assertTrue(set(b.IDS)<=selected)
  known={863:[7,4,1],141:1,142:1,160:5,138:[[7,-1],[13,0],[11,4],[10,2],[1,0]],708:[3,4,1,2],430:[0,2,3,1],116:[-1,2,-1,4,5,6,-1],117:[-1,2,-1,4,5,-1],236:1,1644:-1,1650:1,1123:4,235:1,285:5,426:[3,1,4,0,2],1110:[0,5,6],652:[1,3]}
  for pid,want in known.items():
   with self.subTest(pid=pid):self.assertTrue(b.accepts(pid,b.EDGE[pid][0],b.oracle(pid,b.EDGE[pid][0]),want))
 def test_small_oracles_and_json(self):
  for pid,p in b.PROBLEMS.items():
   r=random.Random(20260917+pid)
   for args in p['edges']+[p['random_args'](r) for _ in range(144)]:
    with self.subTest(pid=pid,args=args):
     p['validate'](args);want=p['oracle'](args);self.assertTrue(b.accepts(pid,args,b.fast(pid,copy.deepcopy(args)),want))
     scope={'sys':sys,'json':json}
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))):exec(p['parse'],scope)
     self.assertEqual(scope['args'],args)
 def test_pressure_and_output_limit(self):
  for pid,p in b.PROBLEMS.items():
   for args,want in p['pressure']:
    with self.subTest(pid=pid):
     p['validate'](args);got=b.fast(pid,copy.deepcopy(args));self.assertTrue(b.accepts(pid,args,got,want))
     if pid==138:text=str(len(want))+'\n'+''.join('2 '+' '.join(map(str,row))+'\n' for row in want)
     elif isinstance(want,list):text=str(len(want))+'\n'+' '.join(map(str,want))+'\n'
     else:text=str(want)+'\n'
     self.assertLessEqual(len(text.encode()),p['outputLimit']*1024)
 def test_two_normal_wrong_answers(self):
  for pid,p in b.PROBLEMS.items():
   for mutant in p['mutants']:
    killed=False
    for args in p['edges']:
     output=io.StringIO()
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))),patch.object(sys,'stdout',output):exec(mutant['source'],{})
     tokens=iter(map(int,output.getvalue().split()))
     if pid==138:got=[[next(tokens) for _ in range(next(tokens))] for _ in range(next(tokens))]
     elif pid in b.ARRAYS:got=[next(tokens) for _ in range(next(tokens))]
     else:got=next(tokens)
     self.assertEqual(list(tokens),[])
     if not b.accepts(pid,args,got,p['oracle'](args)):killed=True;break
    self.assertTrue(killed,f'{pid} {mutant["name"]}')
 def test_constraints(self):
  bad=[(863,[[1],1,0]),(141,[[1],1]),(142,[[],0]),(160,[[],[],[]]),(138,[[[1,1]]]),(708,[[3,2,1],2]),(430,[[[1,0,-1]]]),(116,[[1,2]]),(117,[[101]]),(236,[[1,2],0,0]),(1644,[[1],{'id':0},{'external':1}]),(1650,[[1,2],0,2]),(1123,[[1,1]]),(235,[[1,2],0,1]),(285,[[1],1]),(426,[[1001]]),(1110,[[1],[1,1]]),(652,[[]])]
  for pid,args in bad:
   with self.subTest(pid=pid),self.assertRaises(AssertionError):b.validate(pid,args)
 def test_alternatives_and_identity_distinction(self):
  self.assertTrue(b.accepts(708,[[1,1],2],[1,2,1],[1,1,2]))
  self.assertFalse(b.accepts(708,[[3,4,1],2],[1,2,3,4],[3,4,1,2]))
  self.assertTrue(b.accepts(652,[[1,2,2]],[2],[1]))
  self.assertFalse(b.accepts(652,[[1,2,2]],[1,2],[1]))
  self.assertEqual(b.oracle(160,[[5],[5],[]]),-1)
  self.assertEqual(b.oracle(142,[[5,5],-1]),-1)

if __name__=='__main__':unittest.main()
