"""Independent state oracle vs runtime judge; portable and authored-only."""
import io,json,random,sys,unittest
from pathlib import Path
from unittest.mock import patch
from complex_design_semantics import matches_complex_design,design_results
from . import selected_complex_design1 as b

class ComplexDesignOne(unittest.TestCase):
 def test_membership(self):
  selected={v['number'] for v in json.loads((Path(__file__).resolve().parents[3]/'lib/content/ling-curated-500.json').read_text())}
  self.assertEqual(len(b.PROBLEMS),11);self.assertTrue(set(b.IDS)<=selected)
  for pid,p in b.PROBLEMS.items():self.assertEqual(p['complexDesignId'],pid)
 def test_random_independent_states(self):
  for pid,p in b.PROBLEMS.items():
   r=random.Random(20260918+pid)
   for args in p['edges']+[p['random_args'](r) for _ in range(144)]:
    with self.subTest(pid=pid,args=args):
     p['validate'](args);want=p['oracle'](args);self.assertTrue(matches_complex_design(pid,want+'\n',want,p['encode'](args)))
     actual=json.dumps(design_results(pid,args),separators=(',',':'));self.assertTrue(matches_complex_design(pid,actual,want,p['encode'](args)))
     scope={'json':json,'sys':sys}
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))):exec(p['parse'],scope)
     self.assertEqual(scope['args'],args)
 def test_actual_upper_bounds(self):
  for pid,p in b.PROBLEMS.items():
   for args,want in p['pressure']:
    with self.subTest(pid=pid):
     p['validate'](args);self.assertTrue(matches_complex_design(pid,want,want,p['encode'](args)))
     self.assertLessEqual(len(want.encode())+1,p['outputLimit']*1024)
 def test_two_wrong_traces(self):
  for pid,p in b.PROBLEMS.items():
   for mutant in p['mutants']:
    killed=False
    for args in p['edges']+([p['pressure'][-1][0]] if pid in (380,381) else []):
     output=io.StringIO()
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))),patch.object(sys,'stdout',output):exec(mutant['source'],{})
     if not matches_complex_design(pid,output.getvalue(),p['oracle'](args),p['encode'](args)):killed=True;break
    self.assertTrue(killed,f'{pid} {mutant["name"]}')
 def test_nonunique_results_and_strict_json_types(self):
  cases=[(432,b.trace(432,[],[('inc',['a']),('inc',['b']),('getMaxKey',[]),('getMinKey',[])]),[None,None,None,'b','a']), (380,b.trace(380,[],[('insert',[1]),('insert',[2]),('getRandom',[])]),[None,1,1,2]),(381,b.trace(381,[],[('insert',[1]),('insert',[1]),('insert',[2]),('getRandom',[])]),[None,1,0,1,2]),(295,b.trace(295,[],[('addNum',[1]),('addNum',[2]),('findMedian',[])]),[None,None,None,1.500001])]
  for pid,args,actual in cases:
   self.assertTrue(matches_complex_design(pid,json.dumps(actual),'',json.dumps(args)))
  args=b.trace(380,[],[('insert',[1])]);self.assertFalse(matches_complex_design(380,'[null,true]','',json.dumps(args)))
  self.assertTrue(matches_complex_design(380,'[null,1.0]','',json.dumps(args)))
  self.assertFalse(matches_complex_design(295,'[null,null,NaN]','',json.dumps(b.trace(295,[],[('addNum',[1]),('findMedian',[])]))))
 def test_stable_random_pressure_frequencies(self):
  from collections import Counter
  for pid,frequencies in [(380,{1:2000,2:2000,3:2000,4:2000}),(381,{1:800,2:1600,3:2400,4:3200})]:
   p=b.PROBLEMS[pid];args,want=p['pressure'][-1]
   self.assertEqual(args[0][-8000:],['getRandom']*8000)
   self.assertEqual(Counter(json.loads(want)[-8000:]),frequencies)
   self.assertEqual(Counter(json.loads(p['oracle'](args))[-8000:]),frequencies)
 def test_constraint_failures(self):
  bad=[(173,b.trace(173,[[1]],[('next',[]),('next',[])])),(981,b.trace(981,[],[('set',['a','x',2]),('set',['b','y',2])])),(295,b.trace(295,[],[('findMedian',[])])),(588,b.trace(588,[],[('readContentFromFile',['/missing'])])),(432,b.trace(432,[],[('dec',['a'])])),(380,b.trace(380,[],[('getRandom',[])])),(381,b.trace(381,[],[('getRandom',[])])),(449,b.trace(449,[],[('roundTrip',[[1,2]])]))]
  for pid,args in bad:
   with self.subTest(pid=pid),self.assertRaises(AssertionError):b.validate(pid,args)

if __name__=='__main__':unittest.main()
