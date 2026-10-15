import unittest

from src.clock import FakeClock
from src.limiter import FixedWindowLimiter, TokenBucket
from src.policy import limiter_for


class BucketTest(unittest.TestCase):
    def setUp(self):
        self.clock = FakeClock(100)
        self.bucket = TokenBucket(rate=2, capacity=4, clock=self.clock)

    def test_starts_full(self):
        self.assertTrue(self.bucket.allow('k', cost=4))
        self.assertFalse(self.bucket.allow('k'))

    def test_keys_are_independent(self):
        self.assertTrue(self.bucket.allow('a', cost=4))
        self.assertTrue(self.bucket.allow('b', cost=4))
        self.assertFalse(self.bucket.allow('a'))

    def test_refill_caps_at_capacity(self):
        self.bucket.allow('k', cost=4)
        self.clock.advance(3600)
        self.assertTrue(self.bucket.allow('k', cost=4))
        self.assertFalse(self.bucket.allow('k'))

    def test_partial_refill(self):
        self.bucket.allow('k', cost=4)
        self.clock.advance(0.25)
        self.assertFalse(self.bucket.allow('k'))
        self.clock.advance(0.25)
        self.assertTrue(self.bucket.allow('k'))

    def test_rejected_call_takes_nothing(self):
        self.bucket.allow('k', cost=3)
        self.assertFalse(self.bucket.allow('k', cost=2))
        self.assertTrue(self.bucket.allow('k', cost=1))

    def test_retry_after(self):
        self.assertEqual(self.bucket.retry_after('k'), 0)
        self.bucket.allow('k', cost=4)
        self.assertAlmostEqual(self.bucket.retry_after('k'), 0.5)
        self.assertAlmostEqual(self.bucket.retry_after('k', cost=3), 1.5)
        self.clock.advance(0.2)
        self.assertAlmostEqual(self.bucket.retry_after('k'), 0.3)

    def test_retry_after_takes_nothing(self):
        self.bucket.retry_after('k', cost=4)
        self.assertTrue(self.bucket.allow('k', cost=4))

    def test_cost_over_capacity(self):
        with self.assertRaises(ValueError):
            self.bucket.allow('k', cost=5)
        with self.assertRaises(ValueError):
            self.bucket.retry_after('k', cost=5)

    def test_bad_settings(self):
        for rate, capacity in ((0, 1), (1, 0), (-1, 5)):
            with self.assertRaises(ValueError):
                TokenBucket(rate, capacity, self.clock)


class PolicyTest(unittest.TestCase):
    def test_pro_bursts(self):
        clock = FakeClock()
        limiter = limiter_for('pro', clock)
        self.assertIsInstance(limiter, TokenBucket)
        self.assertEqual(sum(limiter.allow('key') for _ in range(60)), 50)
        clock.advance(1)
        self.assertEqual(sum(limiter.allow('key') for _ in range(60)), 10)

    def test_free_unchanged(self):
        clock = FakeClock()
        limiter = limiter_for('free', clock)
        self.assertIsInstance(limiter, FixedWindowLimiter)
        self.assertEqual(sum(limiter.allow('key') for _ in range(70)), 60)

    def test_unknown_plan(self):
        with self.assertRaises(ValueError):
            limiter_for('gold')


if __name__ == '__main__':
    unittest.main()
