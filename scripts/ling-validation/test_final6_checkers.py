import json,unittest
from pathlib import Path
from float_checkers import matches_floats,parse_floats
from fraction_checker import matches_fraction
ROOT=Path(__file__).resolve().parents[2]
class Final6CheckerTests(unittest.TestCase):
 def test_float_fixtures(self):
  for row in json.loads((ROOT/'fixtures/oj-float-checkers.json').read_text()):
   with self.subTest(name=row['name']):self.assertEqual(matches_floats(row['actual'],row['expected'],row['array']),row['matches'])
  self.assertIsNone(parse_floats('1'*(1024*1024+1)))
 def test_fraction_fixtures(self):
  for row in json.loads((ROOT/'fixtures/oj-fraction-checker.json').read_text()):
   with self.subTest(name=row['name']):self.assertEqual(matches_fraction(row['actual'],row['input']),row['matches'])
  self.assertTrue(matches_fraction('0.('+'3'*9990+')','[1,3]'))
  self.assertFalse(matches_fraction('0.('+'3'*10001+')','[1,3]'))
if __name__=='__main__':unittest.main()
