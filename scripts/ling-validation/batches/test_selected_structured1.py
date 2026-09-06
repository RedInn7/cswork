"""All executable code under test is authored; membership uses tracked content."""
import copy,io,json,random,sys,unittest
from pathlib import Path
from unittest.mock import patch
from . import selected_structured1 as b

class StructuredOne(unittest.TestCase):
 def test_examples_and_membership(self):
  selected={v['number'] for v in json.loads((Path(__file__).resolve().parents[3]/'lib/content/ling-curated-500.json').read_text())}
  self.assertEqual(len(b.IDS),12);self.assertTrue(set(b.IDS)<=selected)
  examples={220:1,273:'One Hundred Twenty Three',1023:[1,0,1,1,0],56:[[1,6],[8,10],[15,18]],57:[[1,5],[6,9]],986:[[1,2],[5,5],[8,10],[15,23],[24,24],[25,25]],1314:[[12,21,16],[27,45,33],[24,39,28]],733:[[2,2,2],[2,2,0],[2,0,1]],286:[[3,-1,0,1],[2,2,1,-1],[1,-1,2,-1],[0,-1,3,4]],542:[[0,0,0],[0,1,0],[1,2,1]],1129:[0,1,-1],1462:[0,1]}
  for pid,want in examples.items():
   with self.subTest(pid=pid):self.assertEqual(b.oracle(pid,b.EDGE[pid][0]),want)
 def test_small_independent_oracles_and_stdio(self):
  for pid,p in b.PROBLEMS.items():
   r=random.Random(20260914+pid)
   for args in p['edges']+[p['random_args'](r) for _ in range(144)]:
    with self.subTest(pid=pid,args=args):
     p['validate'](args);self.assertEqual(p['oracle'](args),b.fast(pid,copy.deepcopy(args)))
     scope={'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))):exec(p['parse'],scope)
     self.assertEqual(scope['args'],args)
 def test_pressure_and_output_limit(self):
  for pid,p in b.PROBLEMS.items():
   for args,want in p['pressure']:
    with self.subTest(pid=pid):
     p['validate'](args);self.assertEqual(b.fast(pid,copy.deepcopy(args)),want)
     scope={'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))):exec(p['parse'],scope)
     self.assertEqual(scope['args'],args)
     if pid in b.ROWS:text=str(len(want))+'\n'+''.join(str(len(row))+' '+' '.join(map(str,row))+'\n' for row in want)
     elif isinstance(want,list):text=str(len(want))+'\n'+' '.join(map(str,want))+'\n'
     else:text=str(want)+'\n'
     self.assertLessEqual(len(text.encode()),p['outputLimit']*1024)
 def test_two_clean_wrong_answer_witnesses(self):
  for pid,p in b.PROBLEMS.items():
   for mutant in p['mutants']:
    killed=False
    for args in p['edges']:
     output=io.StringIO()
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))),patch.object(sys,'stdout',output):exec(mutant['source'],{})
     text=output.getvalue()
     if pid==273:got=text[:-1]
     elif pid==220:got=int(text)
     else:
      tokens=iter(map(int,text.split()));n=next(tokens)
      if pid in b.ROWS:got=[[next(tokens) for _ in range(next(tokens))] for _ in range(n)]
      else:got=[next(tokens) for _ in range(n)]
      self.assertEqual(list(tokens),[])
     want=p['oracle'](args)
     if pid in (56,986):got=sorted(got);want=sorted(want)
     if got!=want:killed=True;break
    self.assertTrue(killed,f'{pid} {mutant["name"]}')
 def test_real_constraints(self):
  bad=[(220,[[1],1,0]),(273,[2**31]),(1023,[['A1'],'A']),(56,[[[2,1]]]),(57,[[[0,2],[2,3]],[0,0]]),(986,[[],[]]),(986,[[[1,1]],[]]),(1314,[[[1]],0]),(733,[[[0]],0,0,65536]),(286,[[[1]]]),(542,[[[1]]]),(542,[[[0]*101 for _ in range(100)]]),(1129,[1,[[0,1]],[]]),(1462,[2,[[0,1],[1,0]],[[0,1]]]),(1462,[3,[[0,1],[0,1]],[[0,1]]]),(1462,[2,[],[[0,0]]])]
  for pid,args in bad:
   with self.subTest(pid=pid,args=args),self.assertRaises(AssertionError):b.validate(pid,args)
 def test_contract_and_corner_cases(self):
  self.assertEqual(b.PROBLEMS[56]['resultKind'],'integer-row-set');self.assertEqual(b.PROBLEMS[986]['resultKind'],'integer-row-set')
  self.assertEqual(b.PROBLEMS[57]['resultKind'],'integer-rows');self.assertEqual(b.PROBLEMS[286]['resultAdapter'],'arg0')
  self.assertEqual(b.oracle(56,[[[0,0],[1,1]]]),[[0,0],[1,1]])
  self.assertEqual(b.oracle(986,[[[0,1]],[[1,2]]]),[[1,1]])
  self.assertEqual(b.oracle(286,[[[b.INF,-1,0]]]),[[b.INF,-1,0]])
  self.assertEqual(b.oracle(273,[1000010]),'One Million Ten')
  for pid in (1023,1462):self.assertEqual(b.PROBLEMS[pid]['resultAdapter'],'boolean-array')

if __name__=='__main__':unittest.main()
