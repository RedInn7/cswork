"""Fixture invariants and independent known-answer regression checks (no reference code)."""
import io
import random
import sys
import unittest
from unittest.mock import patch

from .arrays import PROBLEMS, validate


class ArrayFixturesTest(unittest.TestCase):
    def test_original_value_limits(self):
        validate(914,[[9999,9999]])
        validate(961,[[10000,10000,0,1]])
        for pid,args in ((914,[[10000,10000]]),(961,[[10001,10001,0,1]])):
            with self.subTest(pid=pid),self.assertRaises(AssertionError):validate(pid,args)

    def test_known_answers(self):
        known={28:0,33:4,125:1,136:1,153:1,154:0,169:3,219:1,409:7,455:1,459:1,485:3,521:3,561:4,605:1,628:6,674:3,680:1,696:6,724:3,796:1,844:1,852:1,860:1,914:1,925:1,961:3,976:5,1004:6,1005:5}
        self.assertEqual(set(known),set(PROBLEMS))
        for pid,want in known.items():
            with self.subTest(pid=pid):self.assertEqual(PROBLEMS[pid]['oracle'](PROBLEMS[pid]['edges'][0]),want)

    def test_roundtrip_and_constraint_domain(self):
        for pid,p in PROBLEMS.items():
            rng=random.Random(20260905+pid)
            small=p['edges']+[p['random_args'](rng) for _ in range(120)]
            for args in small+[a for a,_ in p['pressure']]:
                with self.subTest(pid=pid):
                    p['validate'](args)
                    context={'sys':sys}
                    with patch.object(sys,'stdin',io.StringIO(p['encode'](args))):
                        exec(p['parse'],context) # Only our own static codec, never an external solution.
                    self.assertEqual(context['args'],args)
            for args in small:self.assertIsInstance(p['oracle'](args),int)

    def test_rejects_invalid_inputs(self):
        bad={33:[[1,1],1],125:[''],136:[[1,1]],153:[[1,3,2]],154:[[1,3,2]],169:[[1,2]],219:[[1],-1],455:[[1],[0]],561:[[1,2,3]],605:[[1,1],0],628:[[1,2]],852:[[1,2,3]],860:[[15]],961:[[1,1,1,1]],1004:[[1],2],1005:[[1],0],844:['a','']}
        for pid,args in bad.items():
            with self.subTest(pid=pid),self.assertRaises(AssertionError):validate(pid,args)

    def test_mutants_have_a_wrong_answer_witness(self):
        # Execute only authored incorrect programs on tiny inputs; imports are standard library.
        for pid,p in PROBLEMS.items():
            killed=False
            for args in p['edges']:
                out=io.StringIO()
                with patch.object(sys,'stdin',io.StringIO(p['encode'](args))),patch.object(sys,'stdout',out):
                    exec(p['mutants'][0]['source'],{})
                if out.getvalue().strip()!=str(p['oracle'](args)):
                    killed=True;break
            self.assertTrue(killed,f'{pid}: missing explicit mutant counterexample')


if __name__=='__main__':unittest.main()
