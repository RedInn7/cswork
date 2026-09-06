"""Independent authored search regression; no downloaded reference execution."""
import copy,io,json,random,sys,unittest
from pathlib import Path
from unittest.mock import patch
from . import selected_search1 as batch

class SelectedSearchOne(unittest.TestCase):
 def test_selection_and_samples(self):
  selected={v['number'] for v in json.loads((Path(__file__).resolve().parents[3]/'lib/content/ling-curated-500.json').read_text())}
  self.assertEqual(len(batch.PROBLEMS),24);self.assertTrue(set(batch.PROBLEMS)<=selected)
  known={1007:2,678:1,826:100,630:3,871:2,1642:4,502:4,1383:60,1802:2,1074:4,1079:8,291:1,1593:5,79:1,52:2,679:1,1239:4,1255:23,93:['255.255.11.135','255.255.111.35'],267:['abba','baab'],301:['(())()','()()()'],282:['1*2*3','1+2+3'],212:['eat','oath']}
  for pid,want in known.items():
   with self.subTest(pid=pid):self.assertEqual(batch.oracle(pid,batch.EDGES[pid][0]),want)
  self.assertEqual(len(batch.oracle(320,['word'])),16)
 def test_small_oracles_and_roundtrips(self):
  for pid,p in batch.PROBLEMS.items():
   rng=random.Random(20260910+pid)
   for a in p['edges']+[p['random_args'](rng) for _ in range(120)]:
    with self.subTest(pid=pid,args=a):
     p['validate'](a);scope={'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(p['encode'](a))):exec(p['parse'],scope)
     self.assertEqual(scope['args'],a);want=p['oracle'](a);self.assertEqual(batch.variant(pid,copy.deepcopy(a)),want)
     if pid in batch.SETS:self.assertIs(type(want),list);self.assertEqual(len(want),len(set(want)))
     else:self.assertIs(type(want),int)
 def test_pressure_and_output_bounds(self):
  for pid,p in batch.PROBLEMS.items():
   for a,want in p['pressure']:
    with self.subTest(pid=pid):
     p['validate'](a);scope={'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(p['encode'](a))):exec(p['parse'],scope)
     self.assertEqual(scope['args'],a);self.assertEqual(batch.variant(pid,copy.deepcopy(a)),sorted(want) if isinstance(want,list) else want)
     if isinstance(want,list):
      self.assertEqual(len(want),len(set(want)));text=str(len(want))+'\n'+''.join(s+'\n' for s in want)
     else:text=str(want)+'\n'
     self.assertLessEqual(len(text.encode()),p['outputLimit']*1024)
 def test_two_wrong_algorithms(self):
  for pid,p in batch.PROBLEMS.items():
   for mutant in p['mutants']:
    killed=False
    for a in p['edges']:
     out=io.StringIO()
     with patch.object(sys,'stdin',io.StringIO(p['encode'](a))),patch.object(sys,'stdout',out):exec(mutant['source'],{})
     if pid in batch.SETS:
      lines=out.getvalue().split('\n');count=int(lines[0]);self.assertEqual(lines[-1],'');got=lines[1:-1];self.assertEqual(count,len(got));self.assertEqual(len(got),len(set(got)));got.sort()
     else:got=int(out.getvalue())
     if got!=p['oracle'](a):killed=True;break
    self.assertTrue(killed,f'{pid} {mutant["name"]}')
 def test_invalid_domains(self):
  bad={1007:[[1],[1]],678:['a'],826:[[1],[1],[0]],630:[[[0,1]]],871:[10,1,[[10,1]]],1642:[[1],0,2],502:[1,0,[1],[10**9+1]],1383:[1,[1],[1],2],1802:[2,0,1],1074:[[[1001]],0],1079:['a'],291:['','a'],1593:['a'*17],79:[[['1']],'1'],52:[10],679:[[1,2,3,10]],1239:[['']],1255:[['a'],['a'],[11]*26],93:['x'],320:['A'],267:['a'*17],301:['('*21],282:['1',2**31],212:[[['a']],['a','a']]}
  for pid,a in bad.items():
   with self.subTest(pid=pid),self.assertRaises(AssertionError):batch.validate(pid,a)

if __name__=='__main__':unittest.main()
