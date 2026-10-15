import random
import time
import unittest

from src.parser import parse_line
from src.report import render
from src.rollup import rollup

SAMPLE = [
    'GET /users/42 200 13',
    'GET /users/7 200 20',
    'GET /users/7 503 900',
    'POST /orders 201 45',
    'garbage',
    'GET /health 200 1',
    'GET /users/9 200 15',
]


class RollupTest(unittest.TestCase):
    def test_parse(self):
        self.assertEqual(parse_line('GET /a/12/b 404 7'), ('GET', '/a/:id/b', 404, 7))
        self.assertIsNone(parse_line('GET /a 200'))

    def test_rollup(self):
        self.assertEqual(
            rollup(SAMPLE, top=2),
            [('GET /users/:id', 4, 0.25, 900), ('GET /health', 1, 0.0, 1)],
        )

    def test_render(self):
        self.assertIn('GET /users/:id', render(SAMPLE, top=1))

    def test_many_routes_is_fast(self):
        rng = random.Random(7)
        lines = ['GET /r%d/%d 200 %d' % (rng.randrange(2000), rng.randrange(99), rng.randrange(500)) for _ in range(20000)]
        started = time.perf_counter()
        rollup(lines, top=5)
        self.assertLess(time.perf_counter() - started, 1.0)


if __name__ == '__main__':
    unittest.main()
