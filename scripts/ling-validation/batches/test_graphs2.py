import io
import math
import random
import sys
import unittest
from unittest.mock import patch
from batches.graphs2 import PROBLEMS,apple_count,prime_permutation_count

class GraphsSecondBatchTests(unittest.TestCase):
    def test_constraints_stdio_and_small_oracles(self):
        self.assertEqual(len(PROBLEMS),30)
        for pid,p in PROBLEMS.items():
            samples=p['edges']+[p['random_args'](random.Random(pid*1000+i)) for i in range(120)]
            for a in samples+[a for a,_ in p['pressure']]:
                with self.subTest(pid=pid):
                    p['validate'](a);env={'sys':sys}
                    with patch('sys.stdin',io.StringIO(p['encode'](a))):exec(p['parse'],env)
                    self.assertEqual(env['args'],a)
            for a in samples:self.assertIsInstance(p['oracle'](a),int,pid)
    def test_known_answers(self):
        cases={190:([43261596],964176192),371:([-5,-7],-12),1318:([2,6,5],3),1680:([3],27),3226:([13,4],2),9:([-121],0),172:([25],6),204:([10],4),319:([9],3),507:([28],1),633:([5],1),1025:([3],0),1492:([12,3],3),1510:([7],0),1780:([91],1),1823:([5,2],3),1925:([5],2),1952:([9],1),1175:([5],12),1922:([4],400),1954:([13],16),477:([[4,14,2]],6),1558:([[1,5]],5),1835:([[1,2,3],[6,5]],0),2917:([[1,2],2],0),836:([[0,0,1,1],[1,0,2,1]],0),1232:([[[0,0],[1,1],[2,3]]],0),1266:([[[1,1],[3,4],[-1,0]]],7),841:([[[1],[0],[]]],0),207:([2,[[1,0],[0,1]]],0)}
        for pid,(a,y) in cases.items():self.assertEqual(PROBLEMS[pid]['oracle'](a),y,pid)
    def test_factor_rank_respects_original_domain(self):
        p=PROBLEMS[1492]
        for args in ([1,2],[4,5],[1000,1001]):
            with self.assertRaises(AssertionError):p['validate'](args)
        for i in range(120):
            n,k=p['random_args'](random.Random(1492000+i))
            self.assertTrue(1<=k<=n<=1000)
        self.assertEqual(p['oracle']([7,3]),-1)
        self.assertIn('k must not exceed n',p['inputEn'])
    def test_prime_arrangements_use_bounded_permutation_oracle(self):
        prime_permutation_count.cache_clear()
        # Counts for all eight small sizes are derived from the placement formula,
        # separately from the oracle's enumeration of complete arrangements.
        counts=[1,1,2,4,12,36,144,576]
        p=PROBLEMS[1175]
        for n,want in enumerate(counts,1):self.assertEqual(p['oracle']([n]),want)
        for i in range(120):
            args=p['random_args'](random.Random(1175000+i))
            self.assertTrue(1<=args[0]<=8)
            self.assertEqual(p['oracle'](args),counts[args[0]-1])
        self.assertEqual(prime_permutation_count.cache_info().misses,8)
        with self.assertRaises(AssertionError):p['oracle']([9])
    def test_or_flips_include_high_bit_changes(self):
        p=PROBLEMS[1318]
        for args,want in (([536870912,536870912,1],3),([1,1,536870913],1)):
            p['validate'](args)
            self.assertIn((args,want),p['pressure'])
            self.assertEqual(p['oracle'](args),want)
    def test_pressure_math(self):
        r=PROBLEMS[1954]['pressure'][0][1]//8
        self.assertLess(apple_count(r-1),10**15);self.assertGreaterEqual(apple_count(r),10**15)
        squares={x*x for x in range(1,251)}
        self.assertEqual(sum(x*x+y*y in squares for x in range(1,251) for y in range(1,251)),330)
        self.assertEqual(100000*(10**9).bit_count()+29,1300029)
        self.assertEqual(sum(10000//5**i for i in range(1,7)),2499)
        self.assertEqual(PROBLEMS[1823]['oracle']([500,2]),489)
        self.assertEqual(PROBLEMS[1780]['oracle']([10000000]),0)

if __name__=='__main__':unittest.main()
