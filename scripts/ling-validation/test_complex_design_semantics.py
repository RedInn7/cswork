"""The same deterministic protocol/frequency examples are consumed by TypeScript."""
import json
from pathlib import Path
import unittest
from complex_design_semantics import matches_complex_design

class SharedComplexSemantics(unittest.TestCase):
 def test_shared_fixtures(self):
  fixtures=json.loads((Path(__file__).resolve().parents[2]/'fixtures'/'oj-complex-design-checkers.json').read_text())
  for case in fixtures['cases']:
   with self.subTest(name=case['name']):
    self.assertEqual(matches_complex_design(case['id'],case['actual'],'',case['input']),case['accept'])
 def test_empty_random_is_a_rejection_not_stop_iteration(self):
  for pid,classname in [(380,'RandomizedSet'),(381,'RandomizedCollection')]:
   self.assertFalse(matches_complex_design(pid,'[null,0]','',json.dumps([[classname,'getRandom'],[[],[]]])))
