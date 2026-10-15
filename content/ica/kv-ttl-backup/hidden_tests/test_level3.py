import unittest

from src.store import Store


class Level3Hidden(unittest.TestCase):
    def test_plain_put_clears_the_ttl(self):
        store = Store()
        store.put_ttl(1, 'k', 'a', 5)
        self.assertEqual(store.put(2, 'k', 'b'), 'a')
        self.assertEqual(store.get(100, 'k'), 'b')
        self.assertEqual(store.ttl_left(101, 'k'), -1)

    def test_put_ttl_replaces_the_ttl(self):
        store = Store()
        store.put_ttl(1, 'k', 'a', 5)
        self.assertEqual(store.put_ttl(3, 'k', 'b', 10), 'a')
        self.assertEqual(store.get(10, 'k'), 'b')
        self.assertIsNone(store.get(13, 'k'))

    def test_expired_value_is_not_previous(self):
        store = Store()
        store.put_ttl(1, 'k', 'old', 2)
        self.assertIsNone(store.put(3, 'k', 'new'))
        self.assertIsNone(store.put_ttl(4, 'j', 'x', 1))
        self.assertIsNone(store.put_ttl(5, 'j', 'y', 1))

    def test_expired_key_cannot_be_deleted(self):
        store = Store()
        store.put_ttl(1, 'k', 'v', 4)
        self.assertFalse(store.delete(5, 'k'))
        self.assertIsNone(store.ttl_left(6, 'k'))

    def test_expiry_is_exclusive(self):
        store = Store()
        store.put_ttl(10, 'k', 'v', 2)
        self.assertEqual(store.count(11, 'k'), 1)
        self.assertEqual(store.count(12, 'k'), 0)

    def test_counts_mix_ttl_and_plain_keys(self):
        store = Store()
        for i in range(10):
            store.put_ttl(i + 1, f'tmp:{i}', str(i), 10 + i)
        for i in range(10):
            store.put(i + 100, f'keep:{i}', str(i))
        self.assertEqual(store.count(200, ''), 10)
        self.assertEqual(store.scan(201, 'tmp'), [])
