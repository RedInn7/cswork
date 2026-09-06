import json
import unittest
from pathlib import Path
from semantic_checkers import matches_semantic,SEMANTIC_IDS

class SemanticTests(unittest.TestCase):
 def test_shared_fixtures(self):
  fixture=json.loads((Path(__file__).resolve().parents[2]/'fixtures/oj-semantic-checkers.json').read_text())
  covered=set()
  for c in fixture['cases']:
   covered.add(c['id'])
   with self.subTest(name=c['name']):self.assertEqual(matches_semantic(c['id'],c['actual'],c['expected'],c['input']),c['accepted'])
  self.assertTrue(set(SEMANTIC_IDS)<=covered)
 def test_zero_sum_reachability_exhaustive(self):
  # Independent deletion-state search, without prefix alignment logic.
  import itertools
  def terminal_states(values):
   todo=[values];seen={values};answers=set()
   while todo:
    current=todo.pop();terminal=True
    for i in range(len(current)):
     for j in range(i+1,len(current)+1):
      if sum(current[i:j])==0:
       terminal=False;remaining=current[:i]+current[j:]
       if remaining not in seen:seen.add(remaining);todo.append(remaining)
    if terminal:answers.add(current)
   return answers
  def output(v):return str(len(v))+'\n'+' '.join(map(str,v))+'\n'
  for n in range(1,6):
   for values in itertools.product((-1,0,1),repeat=n):
    terminals=terminal_states(values)
    candidates={tuple(values[i] for i in range(n) if mask>>i&1) for mask in range(1<<n)}
    for candidate in candidates:
     self.assertEqual(matches_semantic(1171,output(candidate),output(next(iter(terminals))),json.dumps([values])),candidate in terminals,(values,candidate))
