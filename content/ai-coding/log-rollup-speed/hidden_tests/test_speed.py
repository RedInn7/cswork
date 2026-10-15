import math
import random
import time
import unittest

from src.parser import parse_line
from src.report import render
from src.rollup import rollup


def reference(lines, top=10):
    groups = {}
    for line in lines:
        entry = parse_line(line)
        if entry:
            groups.setdefault(entry.method + ' ' + entry.path, []).append(entry)
    rows = []
    for route, mine in groups.items():
        ordered = sorted(entry.ms for entry in mine)
        errors = sum(entry.status >= 500 for entry in mine)
        rows.append((route, len(mine), round(errors / len(mine), 4), ordered[max(0, math.ceil(0.95 * len(ordered)) - 1)]))
    rows.sort(key=lambda row: (-row[1], row[0]))
    return rows[:top]


def traffic(seed, n, routes):
    rng = random.Random(seed)
    methods = ['GET', 'GET', 'GET', 'POST', 'DELETE']
    out = []
    for _ in range(n):
        if rng.random() < 0.02:
            out.append(rng.choice(['', 'GET', 'GET /x 200', 'GET /x ok 3', 'GET x 200 3', 'GET /x 200 3 extra']))
            continue
        route = rng.randrange(routes)
        status = rng.choice([200, 200, 200, 201, 404, 500, 503])
        out.append('%s /svc%d/%d %d %d' % (methods[route % len(methods)], route, rng.randrange(10**6), status, rng.randrange(3000)))
    return out


class SpeedTest(unittest.TestCase):
    def test_same_answer_as_before(self):
        for seed in range(5):
            lines = traffic(seed, 3000, 40)
            for top in (1, 7, 500):
                self.assertEqual(rollup(lines, top), reference(lines, top))

    def test_ties_and_empty(self):
        lines = ['GET /b 200 1', 'GET /a 200 1', 'POST /a 500 9']
        self.assertEqual(rollup(lines, 3), [('GET /a', 1, 0.0, 1), ('GET /b', 1, 0.0, 1), ('POST /a', 1, 1.0, 9)])
        self.assertEqual(rollup([], 3), [])
        self.assertEqual(rollup(['nonsense'], 3), [])

    def test_render_unchanged(self):
        lines = traffic(11, 2000, 30)
        out = render(lines, top=3).split('\n')
        self.assertEqual(len(out), 4)
        route, count, _, _ = reference(lines, 3)[0]
        self.assertTrue(out[1].startswith(route))
        self.assertIn(str(count), out[1])

    def test_many_routes(self):
        lines = traffic(3, 20000, 2000)
        started = time.perf_counter()
        got = rollup(lines, 20)
        self.assertLess(time.perf_counter() - started, 1.0)
        self.assertEqual(got, reference(lines, 20))

    def test_big_day(self):
        lines = traffic(4, 150000, 60)
        started = time.perf_counter()
        got = rollup(lines, 10)
        self.assertLess(time.perf_counter() - started, 3.0)
        self.assertEqual(got, reference(lines, 10))


if __name__ == '__main__':
    unittest.main()
