"""No downloaded solution execution: validate authored definitions and stdio codecs."""
import io
import random
import sys
import unittest
from unittest.mock import patch
from batches.graphs import PROBLEMS

class GraphBatchTests(unittest.TestCase):
    def test_all_cases_obey_constraints_and_roundtrip(self):
        self.assertEqual(len(PROBLEMS),30)
        for pid,p in PROBLEMS.items():
            cases=p['edges']+[a for a,_ in p['pressure']]+[p['random_args'](random.Random(pid*1000+i)) for i in range(120)]
            for a in cases:
                with self.subTest(pid=pid):
                    p['validate'](a)
                    env={'sys':sys}
                    with patch('sys.stdin',io.StringIO(p['encode'](a))):exec(p['parse'],env)
                    self.assertEqual(env['args'],a)
    def test_small_answers(self):
        examples={200:([[["1","0"],["0","1"]]],2),463:([[[1,0],[1,1]]],8),695:([[[1,0],[0,1]]],1),994:([[[2,1,1],[1,1,0],[0,1,1]]],4),1020:([[[0,0,0],[0,1,0],[0,0,0]]],1),1254:([[[1,1,1],[1,0,1],[1,1,1]]],1),1905:([[[1,0],[0,1]],[[1,1],[1,1]]],0),1091:([[[0,1],[1,0]]],2),1971:([3,[[0,1],[1,2]],0,2],1),547:([[[1,0],[0,1]]],2),231:([1],1),342:([8],0),326:([45],0),191:([7],3),461:([1,4],2),762:([6,10],4),693:([10],1),868:([22],2),1342:([14],6),1486:([5,0],8),2169:([2,3],3),2413:([3],6),2427:([12,6],4),292:([4],0),476:([5],2),1009:([0],1),2652:([7],21),1523:([3,7],3),137:([[-2,-2,-2,7]],7),201:([5,7],4)}
        for pid,(a,b) in examples.items():self.assertEqual(PROBLEMS[pid]['oracle'](a),b,pid)
    def test_numeric_pressure_constants_when_bounded(self):
        for pid in (191,461,762,693,868,1342,1486,2169,2413,2427,476,1009,2652,137):
            for a,y in PROBLEMS[pid]['pressure']:self.assertEqual(PROBLEMS[pid]['oracle'](a),y,pid)

if __name__=='__main__':unittest.main()
