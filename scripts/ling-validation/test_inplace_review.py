"""Independent regression review. Only authored helper/toy code is executed."""
import io,json,random,sys,unittest
from collections import Counter
from unittest.mock import patch
from reference_adapters import adapt_result
from result_contract import compare_output,compare_batch,validate_result,format_result,CHECKERS
from generate_batch import wrapper
from batches.selected_inplace1 import PROBLEMS

class InplaceReview(unittest.TestCase):
 def test_multiset_counts_not_just_membership(self):
  for actual,expected,matches in [
   ('3\n2 1 2\n','3\n1 2 2\n',True),
   ('3\n1 1 2\n','3\n1 2 2\n',False),
   ('2\n1 2\n','3\n1 2 2\n',False),
   ('0\n','0\n',True),('0\n0\n','0\n',False),
   ('3\n-0 +00 0\n','3\n0 0 0\n',True),
   ('2\n+001 -001\n','2\n-1 1\n',True),
   ('1\n1.0\n','1\n1\n',False),('01\n1\n','1\n1\n',False),
   ('1\n9007199254740993\n','1\n9007199254740992\n',False),
   ('2\r\n1 1\r\n','2\n1 1\n',True),
   ('2\n1\u00a01\n','2\n1 1\n',False),
  ]:
   with self.subTest(actual=actual):self.assertEqual(compare_output('int-multiset',actual,expected),matches)
  self.assertTrue(compare_batch('[2,1,2]\n[]\n',[[1,2,2],[]],'integer-multiset','jsonl-v1'))
  self.assertFalse(compare_batch('[1,1,2]\n',[[1,2,2]],'integer-multiset','jsonl-v1'))
  for v in ([True],[1.0],['1']):
   with self.assertRaises(ValueError):validate_result('integer-multiset',v)
  self.assertEqual(format_result('integer-multiset',[]),'0\n')
 def test_adapter_shapes_and_empty_results(self):
  self.assertEqual(adapt_result('prefix-arg0',0,[[99,99]]),[])
  self.assertEqual(adapt_result('prefix-arg0',2,[[2,2,99]]),[2,2])
  for bad in (True,-1,4,2.0,None):
   with self.assertRaises(ValueError):adapt_result('prefix-arg0',bad,[[1,2,3]])
  self.assertEqual(adapt_result('arg0',None,[[1,1]]),[1,1])
  self.assertEqual(adapt_result('matrix-arg0',None,[[[1,2],[3,4]]]),[1,2,3,4])
  with self.assertRaises(ValueError):adapt_result('matrix-arg0',None,[[[1],[2,3]]])
  self.assertEqual(adapt_result('characters-arg0',None,[[' ','a',' ']]),' a ')
  with self.assertRaises(ValueError):adapt_result('characters-arg0',None,[['ab']])
 def test_wrapper_reads_mutated_arguments_for_every_call(self):
  fixtures=[
   ('prefix-arg0','integer-multiset','a[:]=[2,2,99];return 2','3\n1 2 3\n','2\n2 2\n','[[1,2,3],[4]]','[2, 2]\n[2, 2]\n'),
   ('arg0','integer-array','a.reverse()','3\n1 2 3\n','3\n3 2 1\n','[[1,2,3],[4]]','[3, 2, 1]\n[4]\n'),
   ('characters-arg0','string','a.reverse()',' a\n','a \n','[[" ","a"],["b"]]','"a "\n"b"\n'),
   ('matrix-arg0','integer-array','a[0].reverse()','unused','4\n2 1 3 4\n','[[[1,2],[3,4]],[[5,6]]]','[2, 1, 3, 4]\n[6, 5]\n'),
  ]
  for adapter,kind,body,stdin,expected,batch,want in fixtures:
   parse="args=[list(sys.stdin.readline().rstrip('\\n'))]" if adapter=='characters-arg0' else 'args=[[[1,2],[3,4]]]' if adapter=='matrix-arg0' else 'args=[list(map(int,sys.stdin.read().split()))[1:]]'
   source=wrapper(dict(method='solve',resultKind=kind,resultAdapter=adapter,parse=parse),'class Solution:\n def solve(self,a):\n  '+body)
   for batched,input_text,output_text in [(False,stdin,expected),(True,json.dumps([[x] for x in json.loads(batch)]),want)]:
    out=io.StringIO()
    with patch.object(sys,'stdin',io.StringIO(input_text)),patch.object(sys,'stdout',out),patch.object(sys,'argv',['authored']+(['--batch'] if batched else [])):
     exec(source,{'__name__':'__main__'})
    self.assertEqual(out.getvalue(),output_text)
 def test_inplace_cases_and_mutants(self):
  known={26:[1,2],27:[2,2],80:[1,1,2,2,3],88:[1,2,2,3,5,6],283:[1,3,12,0,0],75:[0,0,1,1,2,2],48:[3,1,4,2],344:'olleh',912:[1,2,3,5],350:[2,2],1:[0,1],229:[3],41:3}
  for pid,p in PROBLEMS.items():
   self.assertEqual(p['oracle'](p['edges'][0]),known[pid])
   rng=random.Random(717+pid)
   for a in p['edges']+[p['random_args'](rng) for _ in range(120)]+[a for a,v in p['pressure']]:
    with self.subTest(pid=pid):
     p['validate'](a);encoded=p['encode'](a);scope={'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(encoded)):exec(p['parse'],scope)
     self.assertEqual(a,scope['args'])
   for a,want in p['pressure']:
    validate_result(p['resultKind'],want);self.assertLessEqual(len(format_result(p['resultKind'],want).encode()),p['outputLimit']*1024)
    if pid not in (1,41):self.assertEqual(Counter(p['oracle'](a)) if p['resultKind'].endswith('-set') else p['oracle'](a),Counter(want) if p['resultKind'].endswith('-set') else want)
   for m in p['mutants']:
    killed=False
    for a in p['edges']:
     out=io.StringIO()
     with patch.object(sys,'stdin',io.StringIO(p['encode'](a))),patch.object(sys,'stdout',out):exec(m['source'],{})
     if not compare_output(CHECKERS[p['resultKind']],out.getvalue(),format_result(p['resultKind'],p['oracle'](a))):killed=True;break
    self.assertTrue(killed,(pid,m['name']))

if __name__=='__main__':unittest.main()
