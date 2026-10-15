import unittest

from src.clock import FakeClock
from src.limiter import FixedWindowLimiter, TokenBucket
from src.policy import limiter_for


class FixedWindowTest(unittest.TestCase):
    def test_resets_each_window(self):
        clock = FakeClock()
        limiter = FixedWindowLimiter(2, 10, clock)
        self.assertTrue(limiter.allow('k'))
        self.assertTrue(limiter.allow('k'))
        self.assertFalse(limiter.allow('k'))
        clock.advance(10)
        self.assertTrue(limiter.allow('k'))


class TokenBucketTest(unittest.TestCase):
    def test_burst_then_refill(self):
        clock = FakeClock()
        bucket = TokenBucket(rate=2, capacity=3, clock=clock)
        self.assertEqual([bucket.allow('k') for _ in range(4)], [True, True, True, False])
        clock.advance(0.5)
        self.assertTrue(bucket.allow('k'))
        self.assertFalse(bucket.allow('k'))

    def test_free_plan_keeps_fixed_window(self):
        self.assertIsInstance(limiter_for('free', FakeClock()), FixedWindowLimiter)


if __name__ == '__main__':
    unittest.main()
