import copy
import json
import random
import unittest
from batches.selected_design1 import PROBLEMS,IDS,LIMIT,model,validate,encode
from result_contract import format_result,resource_limits

class DesignTests(unittest.TestCase):
 def test_random_and_codec(self):
  for pid,spec in PROBLEMS.items():
   rng=random.Random(pid+500)
   for _ in range(120):
    a=spec['random_args'](rng);spec['validate'](a)
    self.assertEqual(a,[json.loads(x) for x in spec['encode'](a).splitlines()])
    output=spec['oracle'](a);self.assertEqual(len(output),len(a[0]));format_result(spec['resultKind'],output)
 def test_formal_and_pressure(self):
  for pid,spec in PROBLEMS.items():
   size=0
   for a in spec['edges']:spec['validate'](a);size+=len(encode(a))+len(format_result(spec['resultKind'],model(pid,a)))
   for a,out in spec['pressure']:
    spec['validate'](a);self.assertEqual(len(a[0]),LIMIT[pid]+1);self.assertEqual(len(out),len(a[0]));size+=len(encode(a))+len(format_result(spec['resultKind'],out))
   self.assertLess(size,8*1024*1024,pid)
 def test_resource_contract(self):
  for pid,spec in PROBLEMS.items():
   limits=resource_limits(spec)
   for args in spec['edges']:
    self.assertLessEqual(len(format_result(spec['resultKind'],model(pid,args)).encode()),limits['outputLimit']*1024,pid)
   for args,value in spec['pressure']:
    self.assertLessEqual(len(format_result(spec['resultKind'],value).encode()),limits['outputLimit']*1024,pid)
 def test_closed_form_stateful_pressures(self):
  for pid in (225,232,155,622,641,707,146,460,1146,362,676,1166):
   for args,expected in PROBLEMS[pid]['pressure']:
    self.assertEqual(model(pid,args),expected,pid)
 def test_known_semantics(self):
  traces=[(460,[['LFUCache','put','put','get','put','get','get','put','get','get','get'],[[2],[1,1],[2,2],[1],[3,3],[2],[3],[4,4],[1],[3],[4]]],[None,None,None,1,None,-1,3,None,-1,3,4]),(1146,[['SnapshotArray','set','snap','set','get'],[[3],[0,5],[],[0,6],[0,0]]],[None,None,0,None,5]),(362,[['HitCounter','hit','hit','getHits','getHits'],[[],[1],[1],[300],[301]]],[None,None,None,2,0]),(676,[['MagicDictionary','buildDict','search','search','search'],[[],[['hello'] ],['hello'],['hallo'],['hell']]],[None,None,0,1,0])]
  for pid,a,result in traces:validate(pid,a);self.assertEqual(model(pid,a),result)
 def test_wrong_programs(self):
  import contextlib,io,sys
  for pid,spec in PROBLEMS.items():
   for mutant in spec['mutants']:
    killed=False
    for a in spec['edges']:
     old=sys.stdin;sys.stdin=io.StringIO(encode(a));out=io.StringIO()
     try:
      with contextlib.redirect_stdout(out):exec(mutant['source'],{})
     finally:sys.stdin=old
     if out.getvalue().split()!=format_result(spec['resultKind'],model(pid,a)).split():killed=True;break
    self.assertTrue(killed,(pid,mutant['name']))

 def test_invalid_trace(self):
  for pid,a in [(225,[['MyStack','pop'],[[],[]]]),(1146,[['SnapshotArray','get'],[[1],[0,0]]]),(676,[['MagicDictionary','search'],[[],['a']]]),(362,[['HitCounter','hit','hit'],[[],[2],[1]]]),(707,[['MyLinkedList','get'],[[],[-1]]])]:
   with self.assertRaises(AssertionError):validate(pid,a)
