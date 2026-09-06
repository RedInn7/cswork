"""Portable list fixtures test; no downloaded reference code runs here."""
import io,json,random,sys,unittest
from pathlib import Path
from unittest.mock import patch
from .selected_lists1 import PROBLEMS,validate
from result_contract import format_result,validate_result,CHECKERS,compare_output
class SelectedListsTest(unittest.TestCase):
 def test_known_and_curated(self):
  selected={x['number'] for x in json.loads((Path(__file__).resolve().parents[3]/'lib/content/ling-curated-500.json').read_text())}
  known={203:[1,2,3,4,5],206:[5,4,3,2,1],21:[1,1,2,3,4,4],876:[3,4,5],83:[1,2,3],19:[1,2,3,5],82:[1,2,5],328:[1,3,5,2,4],86:[1,2,2,4,3,5],24:[2,1,4,3],92:[1,4,3,2,5],61:[4,5,1,2,3],234:1,143:[1,4,2,3],2:[7,0,8],445:[7,8,0,7],147:[1,2,3,4],148:[1,2,3,4],23:[1,1,2,3,4,4,5,6],25:[2,1,4,3,5]}
  self.assertEqual(set(known),set(PROBLEMS))
  for n,p in PROBLEMS.items():self.assertIn(n,selected);self.assertEqual(p['oracle'](p['edges'][0]),known[n])
 def test_small_oracles_and_pressure_codec(self):
  for n,p in PROBLEMS.items():
   rng=random.Random(20260908+n);small=p['edges']+[p['random_args'](rng) for _ in range(144)]
   for a in small+[a for a,v in p['pressure']]:
    with self.subTest(n=n):
     p['validate'](a);s=p['encode'](a);scope={'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(s)):exec(p['parse'],scope)
     self.assertEqual(scope['args'],a)
     result=p['oracle'](a);validate_result(p['resultKind'],result);self.assertLessEqual(len(format_result(p['resultKind'],result).encode()),p['outputLimit']*1024)
   for a,v in p['pressure']:self.assertEqual(p['oracle'](a),v)
 def test_mutants_clean_wrong_answers(self):
  for n,p in PROBLEMS.items():
   self.assertEqual(len(p['mutants']),2)
   for m in p['mutants']:
    killed=False
    for a in p['edges']:
     out=io.StringIO()
     with patch.object(sys,'stdin',io.StringIO(p['encode'](a))),patch.object(sys,'stdout',out):exec(m['source'],{})
     if not compare_output(CHECKERS[p['resultKind']],out.getvalue(),format_result(p['resultKind'],p['oracle'](a))):killed=True;break
    with self.subTest(n=n,m=m['name']):self.assertTrue(killed)
 def test_reject_bad_domains(self):
  bad={203:[[0],0],206:[[5001]],21:[[2,1],[]],876:[[]],83:[[2,1]],19:[[1],2],82:[[2,1]],328:[[1000001]],86:[[1],201],24:[[-1]],92:[[1],0,1],61:[[],2000000001],234:[[]],143:[[]],2:[[1,0],[1]],445:[[0,1],[1]],147:[[]],148:[[100001]],23:[[[2,1]]],25:[[1],0]}
  for n,a in bad.items():
   with self.subTest(n=n),self.assertRaises(AssertionError):validate(n,a)
if __name__=='__main__':unittest.main()
