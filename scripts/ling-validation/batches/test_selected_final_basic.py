import copy,io,json,random,sys,unittest
from pathlib import Path
from unittest.mock import patch
from . import selected_final_basic as b

class FinalBasic(unittest.TestCase):
 def test_independent_oracles(self):
  selected={x['number'] for x in json.loads((Path(__file__).resolve().parents[3]/'lib/content/ling-curated-500.json').read_text())}
  self.assertTrue(set(b.IDS)<=selected)
  for pid,p in b.PROBLEMS.items():
   r=random.Random(20260918+pid)
   for a in p['edges']+[p['random_args'](r) for _ in range(144)]:
    with self.subTest(pid=pid,args=a):
     p['validate'](a);self.assertEqual(p['oracle'](copy.deepcopy(a)),b.fast(pid,copy.deepcopy(a)))
     scope={'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(p['encode'](a))):exec(p['parse'],scope)
     self.assertEqual(scope['args'],a)
 def test_pressure(self):
  for pid,p in b.PROBLEMS.items():
   for args,want in p['pressure']:
    p['validate'](args);self.assertEqual(b.fast(pid,copy.deepcopy(args)),want)
 def test_wrong_answers(self):
  for pid,p in b.PROBLEMS.items():
   for mutant in p['mutants']:
    killed=False
    for a in p['edges']:
     output=io.StringIO()
     with patch.object(sys,'stdin',io.StringIO(p['encode'](a))),patch.object(sys,'stdout',output):exec(mutant['source'],{})
     lines=output.getvalue().splitlines()
     actual=lines[0] if pid==1202 else sorted(lines[1:]) if pid==784 else list(map(int,lines[1].split()))
     if actual!=p['oracle'](a):killed=True
    self.assertTrue(killed,(pid,mutant['name']))
 def test_domain(self):
  for pid,a in [(1202,['A',[]]),(1202,['ab',[[0,2]]]),(784,['']), (784,['é']),(632,[[[1,0]]]),(632,[[[]]])]:
   with self.assertRaises(AssertionError):b.validate(pid,a)

if __name__=='__main__':unittest.main()
