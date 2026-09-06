import contextlib,copy,io,json,random,sys,unittest
from unittest.mock import patch
from batches.selected_strings1 import IDS,PROBLEMS,fast,oracle,validate
from string_structures import format_string_structure,matches_string_structure

class StringBatchTests(unittest.TestCase):
 def test_independent_oracles_and_codec(self):
  for pid,p in PROBLEMS.items():
   rng=random.Random(400+pid)
   for args in p['edges']+[p['random_args'](rng) for _ in range(120)]:
    with self.subTest(pid=pid,args=args):
     p['validate'](args);want=p['oracle'](args);got=fast(pid,copy.deepcopy(args))
     self.assertTrue(matches_string_structure(pid,format_string_structure(pid,got),format_string_structure(pid,want)))
     self.assertEqual(json.loads(p['encode'](args)),args)
 def test_maximum_pressures(self):
  for pid,p in PROBLEMS.items():
   total=0
   for args,want in p['pressure']:
    p['validate'](args);got=fast(pid,copy.deepcopy(args));expected=format_string_structure(pid,want)
    self.assertTrue(matches_string_structure(pid,format_string_structure(pid,got),expected),pid)
    self.assertLessEqual(len(expected.encode()),p['outputLimit']*1024)
    total+=len(expected.encode())+len(p['encode'](args).encode())
   self.assertLess(total,128*1024*1024)
  self.assertEqual(len(PROBLEMS[51]['pressure'][0][1]),352)
  self.assertEqual(len(PROBLEMS[131]['pressure'][0][1]),32768)
 def test_mutations_have_wa_witnesses(self):
  for pid,p in PROBLEMS.items():
   for mutant in p['mutants']:
    killed=False
    for args in p['edges']:
     output=io.StringIO()
     with patch.object(sys,'stdin',io.StringIO(p['encode'](args))),contextlib.redirect_stdout(output):exec(mutant['source'],{})
     if not matches_string_structure(pid,output.getvalue(),format_string_structure(pid,p['oracle'](args))):killed=True;break
    self.assertTrue(killed,(pid,mutant['name']))
 def test_directed_examples(self):
  self.assertEqual(oracle(68,[['a','b','c','d','e'],6]),['a  b c','d e   '])
  self.assertEqual(oracle(257,[[1,2,2]]),['1->2','1->2'])
  self.assertEqual(oracle(721,[[['A','a@x.io'],['A','b@x.io']]]),[['A','a@x.io'],['A','b@x.io']])
 def test_sudoku_uniqueness_is_checked(self):
  from batches.selected_strings1 import sudoku_solutions,SUDOKU_HARD
  self.assertEqual(len(sudoku_solutions(list(map(list,SUDOKU_HARD)))),1)
  with self.assertRaises(AssertionError):validate(37,[[['.']*9 for _ in range(9)]])
  puzzle=list(map(list,SUDOKU_HARD));puzzle[0][0]='4'
  with self.assertRaises(AssertionError):validate(37,[puzzle])
 def test_invalid_constraints(self):
  for pid,args in [(49,[[]]),(249,[['']]),(68,[['long'],3]),(257,[[]]),(721,[[['A','a@x.io'],['B','a@x.io']]]),(131,['']), (51,[10]),(130,[[['?']]])]:
   with self.assertRaises(AssertionError):validate(pid,args)
