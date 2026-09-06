"""Checks only authored fixture code; never loads downloaded reference solutions."""
import contextlib
import io
import random
import sys
import unittest
from unittest.mock import patch
from batches.dp import PROBLEMS

SAMPLES={62:28,63:2,64:7,70:2,72:3,91:2,96:5,120:11,152:6,174:7,213:3,221:1,279:3,300:4,343:36,377:7,392:1,416:1,474:4,494:5,509:1,518:4,583:2,650:3,673:2,712:231,746:15,1143:3,1137:4,1312:0}

class DPBatchTest(unittest.TestCase):
    def test_samples_and_codec_and_random_constraints(self):
        self.assertEqual(set(SAMPLES),set(PROBLEMS))
        for pid,p in PROBLEMS.items():
            with self.subTest(pid=pid):
                self.assertEqual(p['oracle'](p['edges'][0]),SAMPLES[pid])
                r=random.Random(20260905+pid)
                small=p['edges']+[p['random_args'](r) for _ in range(120)]
                for args in small+[a for a,_ in p['pressure']]:
                    self.assertTrue(p['validate'](args))
                    ns={'sys':sys}
                    with patch.object(sys,'stdin',io.StringIO(p['encode'](args))):exec(p['parse'],ns)
                    self.assertEqual(ns['args'],args)
                for args in small:self.assertIs(type(p['oracle'](args)),int)

    def test_common_mistakes_rejected_by_edges(self):
        for pid,p in PROBLEMS.items():
            for mutant in p['mutants']:
                with self.subTest(pid=pid,mutant=mutant['name']):
                    killed=False
                    for args in p['edges']:
                        output=io.StringIO()
                        with patch.object(sys,'stdin',io.StringIO(p['encode'](args))),contextlib.redirect_stdout(output):
                            exec(mutant['source'],{})
                        if int(output.getvalue())!=p['oracle'](args):killed=True;break
                    self.assertTrue(killed)

    def test_invalid_constraints_rejected(self):
        invalid={62:[100,100],63:[[[2]]],64:[[[201]]],70:[0],72:['A',''],91:['1'*100],96:[20],120:[[[1],[1]]],152:[[10]*20],174:[[[1001]]],213:[[]],221:[[[1]]],279:[0],300:[[10001]],343:[1],377:[[1,2],1000],392:['a'*101,''],416:[[0]],474:[['2'],1,1],494:[[1000,1],0],509:[31],518:[5000,list(range(1,301))],583:['','a'],650:[0],673:[[1000001]],712:['A','a'],746:[[1]],1143:['','a'],1137:[38],1312:['']}
        for pid,args in invalid.items():
            with self.subTest(pid=pid),self.assertRaises(AssertionError):PROBLEMS[pid]['validate'](args)

if __name__=='__main__':unittest.main()
