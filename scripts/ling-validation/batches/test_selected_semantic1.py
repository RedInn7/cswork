"""Portable semantic fixtures: independent small optima and valid alternatives."""
import copy,io,json,random,sys,unittest
from pathlib import Path
from unittest.mock import patch
from semantic_checkers import matches_semantic
from . import selected_semantic1 as b

def formatted(pid,result):
 if pid in b.STRINGS or pid==162:return str(result)+'\n'
 if pid in (373,2392):return str(len(result))+'\n'+''.join(str(len(row))+' '+' '.join(map(str,row))+'\n' for row in result)
 return str(len(result))+'\n'+(' '.join('null' if v is None else str(v) for v in result)+'\n' if result else '')

class SemanticOne(unittest.TestCase):
 def test_membership_and_metadata(self):
  selected={v['number'] for v in json.loads((Path(__file__).resolve().parents[3]/'lib/content/ling-curated-500.json').read_text())}
  self.assertEqual(len(b.IDS),19);self.assertTrue(set(b.IDS)<=selected)
  for pid,p in b.PROBLEMS.items():self.assertEqual(p['semanticId'],pid)
  self.assertEqual(b.PROBLEMS[109]['listArgs'],[0]);self.assertEqual(b.PROBLEMS[109]['resultTree'],'return')
 def test_independent_small_optima_and_codec(self):
  for pid,p in b.PROBLEMS.items():
   r=random.Random(20260916+pid)
   for args in p['edges']+[p['random_args'](r) for _ in range(144)]:
    with self.subTest(pid=pid,args=args):
     p['validate'](args);expected=formatted(pid,p['oracle'](args));actual=formatted(pid,b.fast(pid,copy.deepcopy(args)));self.assertTrue(matches_semantic(pid,actual,expected,p['encode'](args)),(actual,expected))
     scope={'sys':sys,'json':json}
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))):exec(p['parse'],scope)
     self.assertEqual(scope['args'],args)
 def test_pressure(self):
  for pid,p in b.PROBLEMS.items():
   for args,want in p['pressure']:
    with self.subTest(pid=pid):
     p['validate'](args);actual=formatted(pid,b.fast(pid,copy.deepcopy(args)));expected=formatted(pid,want)
     self.assertTrue(matches_semantic(pid,actual,expected,p['encode'](args)))
     self.assertLessEqual(max(len(actual.encode()),len(expected.encode())),p['outputLimit']*1024)
 def test_mutants_are_semantic_wrong_answers(self):
  for pid,p in b.PROBLEMS.items():
   for mutant in p['mutants']:
    killed=False
    for args in p['edges']:
     output=io.StringIO()
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))),patch.object(sys,'stdout',output):exec(mutant['source'],{})
     if not matches_semantic(pid,output.getvalue(),formatted(pid,p['oracle'](args)),p['encode'](args)):killed=True;break
    self.assertTrue(killed,f'{pid} {mutant["name"]}')
 def test_multiple_legal_answers(self):
  examples=[(5,['babad'],'aba','bab'),(1044,['abcxabcydefzdef'],'abc','def'),(1092,['ab','ba'],'aba','bab'),(1249,['()())()'],'()()()','(())()'),(767,['aab'],'aba','aba'),(1405,[1,1,1],'abc','cba'),(162,[[3,1,2]],0,2),(324,[[1,2,3,4]],[2,4,1,3],[1,3,2,4]),(870,[[2,3],[0,0]],[2,3],[3,2]),(368,[[1,2,3]],[1,2],[1,3]),(210,[3,[[2,0],[2,1]]],[0,1,2],[1,0,2]),(269,[['ab','ac']],'abc','bac'),(373,[[1,2],[1,2],2],[[1,1],[1,2]],[[1,1],[2,1]]),(2392,[2,[[1,2]],[[1,2]]],[[1,0],[0,2]],[[1,0],[0,2]]),(701,[[2,1,3],4],[2,1,3,None,None,None,4],[3,2,4,1]),(108,[[1,2]],[1,None,2],[2,1]),(450,[[2,1,3],2],[1,None,3],[3,1]),(109,[[1,1]],[1,None,1],[1,1]),(1171,[[1,2,-3,3,1]],[3,1],[1,2,1])]
  for pid,args,want,other in examples:
   with self.subTest(pid=pid):self.assertTrue(matches_semantic(pid,formatted(pid,other),formatted(pid,want),b.encode(pid,args)))
 def test_original_constraints(self):
  bad=[(5,['!']),(1044,['a']),(1092,['','a']),(1249,['A']),(767,['A']),(1405,[0,0,0]),(162,[[1,1]]),(324,[[1,1,1]]),(870,[[1],[1,2]]),(368,[[1,1]]),(210,[2,[[1,0],[1,0]]]),(269,[['']]),(373,[[2,1],[1],1]),(2392,[2,[],[[1,2]]]),(701,[[2,1,3],2]),(108,[[1,1]]),(450,[[1,2],0]),(109,[[2,1]]),(1171,[[]])]
  for pid,args in bad:
   with self.subTest(pid=pid),self.assertRaises(AssertionError):b.validate(pid,args)
  b.validate(109,[[1,1,1]]);b.validate(2392,[2,[[1,2],[1,2]],[[1,2]]])

if __name__=='__main__':unittest.main()
