import json,unittest
from pathlib import Path
from string_structures import matches_string_structure,format_string_structure,valid_string_structure
class StringStructuresTests(unittest.TestCase):
 def test_shared_fixtures(self):
  fixture=json.loads((Path(__file__).resolve().parents[2]/'fixtures/oj-string-structures.json').read_text())
  for c in fixture['cases']:
   with self.subTest(name=c['name']):self.assertEqual(matches_string_structure(c['id'],c['actual'],c['expected']),c['accepted'])
 def test_formatter(self):
  for pid,value in [(68,['','  ','"','\\']),(49,[['','a','a']]),(130,[['O','X']])]:
   out=format_string_structure(pid,value);self.assertTrue(matches_string_structure(pid,out,out))
  for value in [[1],[True],[None],[{}],['\0'],['\ud800']]:self.assertFalse(valid_string_structure(68,value))
