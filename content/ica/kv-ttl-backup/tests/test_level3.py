import unittest

from src.store import Store


class Level3Test(unittest.TestCase):
    def test_key_expires(self):
        store = Store()
        self.assertIsNone(store.put_ttl(10, 'session', 'abc', 5))
        self.assertEqual(store.get(14, 'session'), 'abc')
        self.assertIsNone(store.get(15, 'session'))

    def test_ttl_left(self):
        store = Store()
        store.put_ttl(10, 'a', 'x', 20)
        store.put(11, 'b', 'y')
        self.assertEqual(store.ttl_left(12, 'a'), 18)
        self.assertEqual(store.ttl_left(13, 'b'), -1)
        self.assertIsNone(store.ttl_left(14, 'c'))

    def test_expired_keys_leave_scans(self):
        store = Store()
        store.put_ttl(1, 'k1', 'a', 3)
        store.put(2, 'k2', 'b')
        self.assertEqual(store.scan(4, 'k'), ['k2=b'])
