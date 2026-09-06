"""Independent fixture regressions; never execute downloaded references."""
import io,json,random,sys,unittest
from pathlib import Path
from unittest.mock import patch
from .selected_arrays2 import PROBLEMS,oracle,validate
from result_contract import format_result,validate_result,compare_output,CHECKERS

class SelectedArraysTwoTest(unittest.TestCase):
 def test_first_examples_and_membership(self):
  root=Path(__file__).resolve().parents[3]
  curated={x['number'] for x in json.loads((root/'lib/content/ling-curated-500.json').read_text())}
  known={2090:[-1,-1,-1,5,4,4,-1,-1,-1],1109:[10,55,45,25,25],1094:0,370:[-2,0,3,5,3],2381:'ace',435:1,452:2,253:2,1288:2,1851:[3,3,1,4],2055:[2,3],2602:[14,10],34:[3,4],81:1,74:1,240:1,540:2,2300:[4,0,3],875:4,1011:15,1482:3,1283:5,1760:3,2187:3,2226:5,1898:2,410:18,1552:3,378:13,719:0}
  self.assertEqual(set(known),set(PROBLEMS))
  for n,p in PROBLEMS.items():
   with self.subTest(n=n):
    self.assertIn(n,curated);self.assertEqual(p['oracle'](p['edges'][0]),known[n])
 def test_all_small_oracles_codec_and_upper_bounds(self):
  for n,p in PROBLEMS.items():
   r=random.Random(20260906+n);small=p['edges']+[p['random_args'](r) for _ in range(144)]
   for a in small+[a for a,v in p['pressure']]:
    with self.subTest(n=n):
     p['validate'](a);text=p['encode'](a);self.assertLessEqual(len(text.encode()),4*1024*1024);scope={'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(text)):exec(p['parse'],scope)
     self.assertEqual(scope['args'],a)
   self.assertLessEqual(len(p['edges'])+24+len(p['pressure']),64)
   for v in [p['oracle'](a) for a in small]+[v for a,v in p['pressure']]:
    validate_result(p['resultKind'],v);self.assertLessEqual(len(format_result(p['resultKind'],v).encode()),p['outputLimit']*1024)
 def test_two_wrong_solutions_are_clean_wrong_answers(self):
  for n,p in PROBLEMS.items():
   self.assertEqual(len(p['mutants']),2)
   for mutant in p['mutants']:
    killed=False
    for a in p['edges']:
     out=io.StringIO()
     with patch.object(sys,'stdin',io.StringIO(p['encode'](a))),patch.object(sys,'stdout',out):exec(mutant['source'],{})
     if not compare_output(CHECKERS[p['resultKind']],out.getvalue(),format_result(p['resultKind'],p['oracle'](a))):killed=True;break
    with self.subTest(n=n,mutant=mutant['name']):self.assertTrue(killed)
 def test_bad_domains(self):
  bad={2090:[[1],-1],1109:[[[1,2,1]],1],1094:[[[1,1,1]],1],370:[1,[[0,1,0]]],2381:['a',[[0,0,2]]],435:[[[1,1]]],452:[[[1,1]]],253:[[[0,0]]],1288:[[[1,2],[1,2]]],1851:[[[0,1]],[1]],2055:['||',[[0,1]]],2602:[[0],[1]],34:[[2,1],1],81:[[2,1,3],1],74:[[[1,3],[2,4]],2],240:[[[2,1]],1],540:[[1,1]],2300:[[1],[0],1],875:[[1,1],1],1011:[[1],2],1482:[[1],1,2],1283:[[1,1],1],1760:[[1],0],2187:[[1],0],2226:[[1],0],1898:['abc','d',[]],410:[[1],2],1552:[[1,1],2],378:[[[1,2]],1],719:[[1,2],2]}
  for n,a in bad.items():
   with self.subTest(n=n),self.assertRaises(AssertionError):validate(n,a)
 def test_pressure_boundary_proofs(self):
  for n in (875,1283,1760,2187,2226):
   for a,want in PROBLEMS[n]['pressure']:
    x,threshold=a
    if n in (875,1283):feasible=lambda v:sum((t+v-1)//v for t in x)<=threshold
    elif n==1760:feasible=lambda v:sum((t-1)//v for t in x)<=threshold
    elif n==2187:feasible=lambda v:sum(v//t for t in x)>=threshold
    else:feasible=lambda v:sum(t//v for t in x)>=threshold
    self.assertTrue(feasible(want))
    if n==2226:self.assertFalse(feasible(want+1))
    elif want>1:self.assertFalse(feasible(want-1))
  for n in (1109,370,1851,2055,2602,2300,2090):
   for a,want in PROBLEMS[n]['pressure']:
    for i in {0,len(want)//2,len(want)-1}:
     if n==1109:actual=sum(v for l,r,v in a[0] if l<=i+1<=r)
     elif n==370:actual=sum(v for l,r,v in a[1] if l<=i<=r)
     elif n==1851:actual=min(r-l+1 for l,r in a[0] if l<=a[1][i]<=r)
     elif n==2055:
      s=a[0];l,r=a[1][i];left=s.find('|',l,r+1);right=s.rfind('|',l,r+1);actual=s[left:right].count('*') if left>=0 and right>left else 0
     elif n==2602:actual=sum(abs(v-a[1][i]) for v in a[0])
     elif n==2300:actual=sum(a[0][i]*v>=a[2] for v in a[1])
     else:actual=sum(a[0][i-a[1]:i+a[1]+1])//(2*a[1]+1) if a[1]<=i<len(a[0])-a[1] else -1
     self.assertEqual(actual,want[i])
  self.assertEqual(PROBLEMS[410]['pressure'][0][1],1000*1000000//50)
  self.assertEqual(PROBLEMS[1011]['pressure'][0][1],500*50000)

if __name__=='__main__':unittest.main()
