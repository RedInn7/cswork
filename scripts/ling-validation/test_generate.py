"""Contract tests for our authored generator, never imported reference solutions."""
import random
import unittest
from generate import IDS, EDGE, PRESSURE, brute, encode, random_args

class FixtureTests(unittest.TestCase):
    def test_known_answers(self):
        for pid,args,want in [(3,['abba'],2),(11,[[1,8,6,2,5,4,8,3,7]],49),(35,[[1,3],2],1),(53,[[-3,-1,-2]],-1),(121,[[7,6,4]],0),(198,[[2,1,1,2]],4),(209,[7,[2,3,1,2,4,3]],2),(322,[[2],3],-1),(69,[8],2),(1456,['abciiidef',3],3)]:
            with self.subTest(pid=pid):self.assertEqual(brute(pid,args),want)
    def test_seed_repeatable(self):
        for pid in IDS:
            a=random.Random(20260905+pid);b=random.Random(20260905+pid)
            self.assertEqual([random_args(pid,a) for _ in range(120)],[random_args(pid,b) for _ in range(120)])
    def test_limits_and_protocol(self):
        for pid in IDS:
            self.assertLessEqual(len(EDGE[pid])+24+len(PRESSURE[pid]),64)
            for args in EDGE[pid]+[x for x,_ in PRESSURE[pid]]:
                text=encode(pid,args);self.assertLess(len(text.encode()),4*1024*1024)
                if pid==3:self.assertEqual(text[:-1],args[0]);continue
                if pid==1456:self.assertEqual(text.splitlines(),[args[0],str(args[1])]);continue
                if pid==69:self.assertEqual(int(text),args[0]);continue
                nums=args[1] if pid==209 else args[0];lines=text.splitlines();head=list(map(int,lines[0].split()))
                self.assertEqual(head[0],len(nums));self.assertEqual(list(map(int,lines[1].split())),nums)
                if len(args)==2:self.assertEqual(head[1],args[0] if pid==209 else args[1])
if __name__=='__main__':unittest.main()
